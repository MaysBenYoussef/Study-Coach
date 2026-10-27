const express  = require('express');
const router   = express.Router();
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

router.post('/register', async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password)
    return res.status(400).json({ success: false, error: 'Tous les champs sont requis.' });
  if (password.length < 6)
    return res.status(400).json({ success: false, error: 'Mot de passe : 6 caractères minimum.' });

  const { data, error } = await supabase.auth.signUp({
    email, password,
    options: { data: { name, role: 'student' } }
  });
  if (error) return res.status(400).json({ success: false, error: error.message });

  res.status(201).json({
    success: true,
    token: data.session?.access_token,
    user:  { id: data.user.id, name, email: data.user.email, role: 'student' }
  });
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ success: false, error: 'Email et mot de passe requis.' });

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return res.status(401).json({ success: false, error: 'Email ou mot de passe incorrect.' });

  // Get role from profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('name, role')
    .eq('id', data.user.id)
    .single();

  const name = profile?.name || data.user.user_metadata?.name || email.split('@')[0];
  const role = profile?.role || 'student';

  res.json({
    success: true,
    token: data.session.access_token,
    user:  { id: data.user.id, name, email: data.user.email, role }
  });
});

router.post('/logout', async (req, res) => {
  await supabase.auth.signOut();
  res.json({ success: true });
});

router.get('/me', require('../middleware/auth').requireAuth, async (req, res) => {
  const { data } = await supabase
    .from('profiles')
    .select('id, name, role, created_at')
    .eq('id', req.userId)
    .single();
  res.json({ success: true, user: { ...data, email: req.userEmail } });
});

module.exports = router;
