const express  = require('express');
const router   = express.Router();
const { createClient } = require('@supabase/supabase-js');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const fetch    = require('node-fetch');
require('dotenv').config();

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';

router.use(requireAuth);
router.use(requireAdmin);

function adminClient(token) {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } }
  });
}

// ── GET /api/admin/stats — global platform stats ────────────
router.get('/stats', async (req, res) => {
  const db = adminClient(req.supabaseToken);
  try {
    const [usersRes, plansRes, sessionsRes] = await Promise.all([
      db.from('profiles').select('id, name, role, created_at'),
      db.from('study_plans').select('id, user_id, mode, created_at'),
      db.from('study_sessions').select('id, user_id, duration_minutes, completed, started_at'),
    ]);

    const users    = usersRes.data    || [];
    const plans    = plansRes.data    || [];
    const sessions = sessionsRes.data || [];

    const totalMinutes = sessions.filter(s => s.completed).reduce((a, s) => a + (s.duration_minutes || 0), 0);

    // Plans by mode
    const plansByMode = { lazy: 0, balanced: 0, hardcore: 0 };
    plans.forEach(p => { if (plansByMode[p.mode] !== undefined) plansByMode[p.mode]++; });

    // Activity last 7 days
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recentSessions = sessions.filter(s => new Date(s.started_at) > since && s.completed);
    const byDay = {};
    recentSessions.forEach(s => {
      const d = s.started_at.split('T')[0];
      byDay[d] = (byDay[d] || 0) + (s.duration_minutes || 0);
    });
    const weekly = Object.entries(byDay).map(([day, minutes]) => ({ day, minutes })).sort((a,b) => a.day.localeCompare(b.day));

    res.json({
      success: true,
      stats: {
        total_users:    users.length,
        total_students: users.filter(u => u.role === 'student').length,
        total_admins:   users.filter(u => u.role === 'admin').length,
        total_plans:    plans.length,
        total_sessions: sessions.length,
        total_minutes:  totalMinutes,
        plans_by_mode:  plansByMode,
        weekly,
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── GET /api/admin/users — all users with their stats ───────
router.get('/users', async (req, res) => {
  const db = adminClient(req.supabaseToken);
  try {
    const { data: users, error } = await db
      .from('user_stats')
      .select('*')
      .order('total_plans', { ascending: false });

    if (error) throw new Error(error.message);
    res.json({ success: true, users: users || [] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── PATCH /api/admin/users/:id/role — change user role ──────
router.patch('/users/:id/role', async (req, res) => {
  const { role } = req.body;
  if (!['student', 'admin'].includes(role))
    return res.status(400).json({ success: false, error: 'Rôle invalide. Utilise "student" ou "admin".' });

  // Prevent self-demotion
  if (req.params.id === req.userId && role === 'student')
    return res.status(400).json({ success: false, error: 'Vous ne pouvez pas vous retirer le rôle admin.' });

  const db = adminClient(req.supabaseToken);
  const { error } = await db.from('profiles').update({ role }).eq('id', req.params.id);
  if (error) return res.status(500).json({ success: false, error: error.message });
  res.json({ success: true, message: `Rôle mis à jour : ${role}` });
});

// ── DELETE /api/admin/users/:id — delete a user's data ──────
router.delete('/users/:id', async (req, res) => {
  if (req.params.id === req.userId)
    return res.status(400).json({ success: false, error: 'Vous ne pouvez pas supprimer votre propre compte.' });

  const db = adminClient(req.supabaseToken);
  // Delete plans and sessions (cascade handles profile)
  await db.from('study_sessions').delete().eq('user_id', req.params.id);
  await db.from('study_plans').delete().eq('user_id', req.params.id);
  const { error } = await db.from('profiles').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ success: false, error: error.message });
  res.json({ success: true });
});

// ── GET /api/admin/plans — all plans from all users ─────────
router.get('/plans', async (req, res) => {
  const db = adminClient(req.supabaseToken);
  const { data, error } = await db
    .from('study_plans')
    .select('id, title, situation, mode, model_used, created_at, user_id, profiles(name)')
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) return res.status(500).json({ success: false, error: error.message });
  const plans = (data || []).map(p => ({
    ...p,
    user_name: p.profiles?.name || 'Inconnu',
    profiles: undefined,
  }));
  res.json({ success: true, plans });
});

// ── GET /api/admin/ollama — Ollama status + models ──────────
router.get('/ollama', async (req, res) => {
  try {
    const r = await fetch(`${OLLAMA_URL}/api/tags`, { signal: AbortSignal.timeout(4000) });
    if (!r.ok) throw new Error(`Ollama retourné ${r.status}`);
    const data = await r.json();
    res.json({
      success: true,
      online: true,
      current_model: process.env.OLLAMA_MODEL || 'non défini',
      pdf_model:     process.env.PDF_MODEL     || 'non défini',
      available_models: (data.models || []).map(m => ({
        name: m.name,
        size: m.size,
        modified: m.modified_at,
      }))
    });
  } catch (err) {
    res.json({ success: true, online: false, available_models: [], error: err.message });
  }
});

module.exports = router;
