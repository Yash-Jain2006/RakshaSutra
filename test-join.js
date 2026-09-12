import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
dotenv.config()

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY
const supabaseRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY // if available

if (!supabaseUrl || !supabaseAnonKey) {
  console.log('Missing env vars')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseRoleKey || supabaseAnonKey)

async function test() {
  const { data, error } = await supabase
    .from('rakshak_profiles')
    .select('profile_id, coverage_area, profiles(display_name, id)')
    .limit(1)

  console.log('Data:', JSON.stringify(data, null, 2))
  console.log('Error:', error)
}

test()
