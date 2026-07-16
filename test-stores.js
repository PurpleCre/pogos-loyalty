require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.EXPO_PUBLIC_SUPABASE_URL, process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY);

async function checkStores() {
  const { data, error } = await supabase.from('stores').select('*');
  console.log("Stores Error:", error);
  console.log("Stores Data:", data);
}
checkStores();
