const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

async function initDB() {
  const { error } = await supabase.from('profiles').select('id').limit(1);
  if (error && error.code !== 'PGRST116') {
    console.error('❌  Supabase connection error:', error.message);
    throw error;
  }
  console.log('✅  Supabase connected');
}

module.exports = { supabase, initDB };
