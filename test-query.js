const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.secret_key;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function testQuery() {
  const { data, error } = await supabase
    .from('profiles')
    .select(`
      id,
      email,
      full_name,
      created_at,
      user_points (
        current_points,
        total_earned,
        total_redeemed
      ),
      user_roles (
        role,
        staff_store_id
      )
    `)
    .order('created_at', { ascending: false });

  console.log('Error:', error);
  console.log('Data:', data);
}

testQuery();
