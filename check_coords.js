import { createClient } from '@supabase/supabase-js';
const supabaseUrl = 'https://dtrhljojqpobzhoixamb.supabase.co';
const supabaseKey = 'sb_publishable_3Yvzgm3t9IZmHCmhDcMqVg_7uehDeCD';
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data, error } = await supabase.from('rakshak_profiles').select('profile_id, coverage_latitude');
  console.log(data, error);
}
check();
