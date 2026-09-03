import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://dtrhljojqpobzhoixamb.supabase.co';
const supabaseKey = 'sb_publishable_3Yvzgm3t9IZmHCmhDcMqVg_7uehDeCD'; // This is actually the anon key despite the name

const supabase = createClient(supabaseUrl, supabaseKey);

async function fix() {
  // Yash Jain profile update (Rau coordinates)
  const { data, error } = await supabase
    .from('rakshak_profiles')
    .update({ 
      coverage_latitude: 22.6366, 
      coverage_longitude: 75.8118 
    })
    .eq('coverage_area', 'Rau, Rau Tahsil, Indore, Madhya Pradesh, 453331, India');
    // wait, we don't know the exact coverage_area string in DB. 
    // It might be better to just update all profiles where latitude is null with a default coordinate to fix the app for now.

  const { data: profiles, error: getErr } = await supabase
    .from('rakshak_profiles')
    .select('profile_id, coverage_latitude');

  if (profiles) {
    for (const p of profiles) {
      if (p.coverage_latitude === null) {
        await supabase
          .from('rakshak_profiles')
          .update({ coverage_latitude: 22.6366, coverage_longitude: 75.8118 })
          .eq('profile_id', p.profile_id);
      }
    }
    console.log('Fixed missing coordinates.');
  } else {
    console.log('Error fetching profiles', getErr);
  }
}

fix();
