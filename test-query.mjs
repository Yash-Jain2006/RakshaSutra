import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('.env', 'utf8');
const urlMatch = env.match(/VITE_SUPABASE_URL=(.*)/);
const keyMatch = env.match(/VITE_SUPABASE_PUBLISHABLE_KEY=(.*)/);

const client = createClient(urlMatch[1].trim(), keyMatch[1].trim());

async function run() {
  const { data, error } = await client
    .from('rakshak_profiles')
    .select(`
      profile_id,
      coverage_area,
      status,
      profiles!rakshak_profiles_profile_id_fkey ( display_name, role )
    `);
  console.log("Error:", error);
  console.log("Data:", JSON.stringify(data, null, 2));
}

run();
