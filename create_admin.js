import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://dtrhljojqpobzhoixamb.supabase.co';
const supabaseKey = 'sb_publishable_3Yvzgm3t9IZmHCmhDcMqVg_7uehDeCD';
const supabase = createClient(supabaseUrl, supabaseKey);

async function createAdmin() {
  const { data, error } = await supabase.auth.signUp({
    email: 'rakshaasutra@gmail.com',
    password: 'rakshaasutra',
    options: {
      data: {
        display_name: 'Super Admin',
      }
    }
  });
  if (error) {
    console.error('Error creating admin:', error.message);
  } else {
    console.log('Admin created successfully:', data.user?.email);
  }
}
createAdmin();
