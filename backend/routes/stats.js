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
  const [plansRes, sessionsRes] = await Promise.all([
    db.from('study_plans').select('id', { count: 'exact', head: true }),
    db.from('study_sessions').select('id, duration_minutes, completed, started_at')
  ]);
  const total_plans   = plansRes.count || 0;
  const sessions      = sessionsRes.data || [];
  const total_minutes = sessions.filter(s => s.completed).reduce((a, s) => a + (s.duration_minutes || 0), 0);
  const days          = new Set(sessions.filter(s => s.completed).map(s => s.started_at?.split('T')[0]).filter(Boolean));
  res.json({ success: true, stats: { total_plans, total_sessions: sessions.length, total_minutes_studied: total_minutes, study_days: days.size } });
});

router.get('/weekly', async (req, res) => {
  const db    = getUserClient(req.supabaseToken);
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data } = await db.from('study_sessions').select('started_at, duration_minutes').eq('completed', true).gte('started_at', since);
  const byDay = {};
  (data || []).forEach(s => { const d = s.started_at.split('T')[0]; byDay[d] = (byDay[d] || 0) + (s.duration_minutes || 0); });
  const weekly = Object.entries(byDay).map(([day, minutes]) => ({ day, minutes })).sort((a, b) => a.day.localeCompare(b.day));
  res.json({ success: true, weekly });
});

module.exports = router;
