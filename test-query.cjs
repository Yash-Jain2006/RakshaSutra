import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://obshmdttngjuznnyvrmk.supabase.co'; // Get from .env if needed
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '...'; // I will read from .env

const fs = require('fs');
const env = fs.readFileSync('.env', 'utf8');
const urlMatch = env.match(/VITE_SUPABASE_URL=(.*)/);
const keyMatch = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/);

const client = createClient(urlMatch[1], keyMatch[1]);

async function run() {
  const { data, error } = await client
    .from('rakshak_profiles')
    .select(`
      profile_id,
      coverage_area,
      status,
      profiles ( display_name, role )
    `);
  console.log("Error:", error);
  console.log("Data:", JSON.stringify(data, null, 2));
}

run();
