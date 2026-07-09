const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDb() {
  const categories = await supabase.from('menu_categories').select('*');
  const items = await supabase.from('menu_items').select('*');
  console.log('Categories:', JSON.stringify(categories.data));
  console.log('Items:', JSON.stringify(items.data));
}
checkDb();
