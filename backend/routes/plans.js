const express  = require('express');
const router   = express.Router();
const { createClient } = require('@supabase/supabase-js');
const { requireAuth }  = require('../middleware/auth');
require('dotenv').config();

router.use(requireAuth);

function getUserClient(token) {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } }
  });
}

router.get('/', async (req, res) => {
  const db = getUserClient(req.supabaseToken);
  const { data, error } = await db
    .from('study_plans')
    .select('id, title, situation, mode, model_used, created_at')
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) return res.status(500).json({ success: false, error: error.message });
  res.json({ success: true, plans: data });
});

router.get('/:id', async (req, res) => {
  const db = getUserClient(req.supabaseToken);
  const { data, error } = await db.from('study_plans').select('*').eq('id', req.params.id).single();
  if (error) return res.status(404).json({ success: false, error: 'Plan introuvable.' });
  res.json({ success: true, plan: data });
});

router.post('/', async (req, res) => {
  const { situation, mode, plan_text, model_used } = req.body;
  if (!situation || !mode || !plan_text)
    return res.status(400).json({ success: false, error: 'Champs manquants.' });
  const title = situation.slice(0, 70) + (situation.length > 70 ? '...' : '');
  const db = getUserClient(req.supabaseToken);
  const { data, error } = await db
    .from('study_plans')
    .insert({ user_id: req.userId, title, situation, mode, plan_text, model_used: model_used || 'ollama' })
    .select('id, title, mode, created_at').single();
  if (error) return res.status(500).json({ success: false, error: error.message });
  res.status(201).json({ success: true, plan: data });
});

router.delete('/:id', async (req, res) => {
  const db = getUserClient(req.supabaseToken);
  const { error } = await db.from('study_plans').delete().eq('id', req.params.id).eq('user_id', req.userId);
  if (error) return res.status(500).json({ success: false, error: error.message });
  res.json({ success: true });
});

module.exports = router;
