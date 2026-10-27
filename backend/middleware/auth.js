const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

async function requireAuth(req, res, next) {
  const header = req.headers['authorization'];
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'Token manquant.' });
  }
  const token = header.slice(7);
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    return res.status(401).json({ success: false, error: 'Session expirée. Reconnectez-vous.' });
  }

  // Use user-authenticated client so RLS allows reading own profile
  const userClient = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  );
  const { data: profile } = await userClient
    .from('profiles')
    .select('role, name')
    .eq('id', data.user.id)
    .single();

  req.userId        = data.user.id;
  req.userEmail     = data.user.email;
  req.userRole      = profile?.role || 'student';
  req.userName      = profile?.name || '';
  req.supabaseToken = token;
  next();
}

function requireAdmin(req, res, next) {
  if (req.userRole !== 'admin') {
    return res.status(403).json({ success: false, error: 'Accès refusé. Compte administrateur requis.' });
  }
  next();
}

module.exports = { requireAuth, requireAdmin };