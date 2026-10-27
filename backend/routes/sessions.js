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

router.post('/', async (req, res) => {
  const { plan_id, duration_minutes, session_type, completed } = req.body;
  if (!duration_minutes) return res.status(400).json({ success: false, error: 'duration_minutes requis.' });
  const db = getUserClient(req.supabaseToken);
  const { data, error } = await db.from('study_sessions')
    .insert({ user_id: req.userId, plan_id: plan_id || null, duration_minutes, session_type: session_type || 'focus', completed: completed !== false, ended_at: new Date().toISOString() })
    .select().single();
  if (error) return res.status(500).json({ success: false, error: error.message });
  res.status(201).json({ success: true, session: data });
});

router.get('/', async (req, res) => {
  const db = getUserClient(req.supabaseToken);
  const { data, error } = await db.from('study_sessions')
    .select('*, study_plans(title)')
    .order('started_at', { ascending: false }).limit(30);
  if (error) return res.status(500).json({ success: false, error: error.message });
  const sessions = (data || []).map(s => ({ ...s, plan_title: s.study_plans?.title || null, study_plans: undefined }));
  res.json({ success: true, sessions });
});

module.exports = router;
