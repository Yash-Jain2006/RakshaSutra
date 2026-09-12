require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
async function test() {
  const { data, error } = await supabase.from('rakshak_ratings').select('*').limit(1);
  console.log('ratings:', error || 'exists');
  const { data: profiles, error: pError } = await supabase.from('rakshak_profiles').select('total_ratings').limit(1);
  console.log('profiles total_ratings:', pError || 'exists');
}
test();
