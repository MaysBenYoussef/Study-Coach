const express  = require('express');
const router   = express.Router();
const fetch    = require('node-fetch');
const { createClient } = require('@supabase/supabase-js');
const { requireAuth }  = require('../middleware/auth');
require('dotenv').config();

const OLLAMA_URL   = process.env.OLLAMA_URL   || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'qwen3:8b';

function getUserClient(token) {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } }
  });
}

router.get('/status', requireAuth, async (req, res) => {
  const db = getUserClient(req.supabaseToken);
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: sessions } = await db.from('study_sessions').select('started_at, duration_minutes, completed').gte('started_at', since).eq('completed', true).order('started_at', { ascending: false });
  const { data: plans } = await db.from('study_plans').select('id, created_at, situation, mode').order('created_at', { ascending: false }).limit(1);

  const latestPlan = plans?.[0] || null;
  const days = new Set((sessions || []).map(s => s.started_at?.split('T')[0]).filter(Boolean));
  const today = new Date();
  const daysSinceLast = sessions?.length > 0 ? Math.floor((today - new Date(sessions[0].started_at)) / 86400000) : null;
  const totalMins = (sessions || []).reduce((a, s) => a + (s.duration_minutes || 0), 0);

  let status = 'on_track', message = '', alertLevel = 'none';
  if (!sessions || sessions.length === 0) { status='not_started'; message="Tu n'as pas encore étudié cette semaine."; alertLevel='warn'; }
  else if (daysSinceLast >= 3) { status='behind'; message=`Tu n'as pas étudié depuis ${daysSinceLast} jours.`; alertLevel='danger'; }
  else if (daysSinceLast >= 1 && days.size < 3) { status='slipping'; message=`Tu as étudié seulement ${days.size} jour(s) cette semaine.`; alertLevel='warn'; }
  else { status='on_track'; message=`Super ! ${days.size} jour(s) d'étude cette semaine.`; alertLevel='none'; }

  res.json({ success:true, status, alertLevel, message, stats:{ daysActive:days.size, daysSinceLastSession:daysSinceLast, totalMinutesThisWeek:totalMins, sessionsThisWeek:(sessions||[]).length }, hasActivePlan:!!latestPlan, latestPlan: latestPlan ? { id:latestPlan.id, created_at:latestPlan.created_at, mode:latestPlan.mode, situation:latestPlan.situation?.slice(0,80) } : null });
});

router.post('/adjust', requireAuth, async (req, res) => {
  const { original_situation, original_mode, days_behind, days_active } = req.body;
  const prompt = `Tu es un coach de rattrapage académique.\n\nSituation originale : ${original_situation||'étudiant en retard'}\nMode : ${(original_mode||'balanced').toUpperCase()}\nJours sans étudier : ${days_behind??'inconnu'}\nJours actifs cette semaine : ${days_active??0}/7\n\nCrée un plan de RATTRAPAGE réaliste qui reconnaît le retard, réajuste les objectifs et motive l'étudiant à reprendre. Planning jour par jour pour la semaine. Commence par une phrase d'encouragement.`;

  res.setHeader('Content-Type','text/event-stream');
  res.setHeader('Cache-Control','no-cache');
  res.setHeader('Connection','keep-alive');
  res.flushHeaders();
  const send = d => res.write(`data: ${JSON.stringify(d)}\n\n`);

  try {
    const r = await fetch(`${OLLAMA_URL}/api/chat`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ model:OLLAMA_MODEL, messages:[{role:'user',content:prompt}], stream:true, options:{temperature:0.4} }) });
    if (!r.ok) { send({error:`Ollama erreur ${r.status}`}); return res.end(); }
    let full = '';
    for await (const chunk of r.body) {
      for (const line of chunk.toString().split('\n').filter(l=>l.trim())) {
        try { const d=JSON.parse(line); if(d.message?.content){full+=d.message.content;send({token:d.message.content});} if(d.done)send({done:true,full}); } catch{}
      }
    }
  } catch(err) { send({error:err.message}); }
  finally { res.end(); }
});

module.exports = router;
