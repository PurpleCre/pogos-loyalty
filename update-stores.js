const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.secret_key;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function updateStores() {
  const { data: stores, error: fetchError } = await supabase.from('stores').select('*').order('distance_miles');
  
  if (fetchError || !stores || stores.length === 0) {
    console.error("Error fetching stores:", fetchError);
    return;
  }

  // Update the first store to Kamfinsa
  if (stores[0]) {
    await supabase.from('stores').update({
      name: "Pogo's Kamfinsa", 
      address: "Shops 1 & 2, Kamfinsa Shopping Centre, Greendale, Harare", 
      distance_miles: 1.2, 
      is_open: true, 
      latitude: -17.8083, 
      longitude: 31.1098, 
      image_url: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=500&q=80" 
    }).eq('id', stores[0].id);
  }

  // Update the second store to Msasa
  if (stores[1]) {
    await supabase.from('stores').update({
      name: "Pogo's Msasa", 
      address: "94 Mutare Road, Msasa, Harare", 
      distance_miles: 3.1, 
      is_open: true, 
      latitude: -17.8427, 
      longitude: 31.0968, 
      image_url: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=500&q=80" 
    }).eq('id', stores[1].id);
  }

  // Mark any remaining stores as closed
  for (let i = 2; i < stores.length; i++) {
    await supabase.from('stores').update({
      name: "Pogo's Closed Branch",
      is_open: false,
      distance_miles: 99.9
    }).eq('id', stores[i].id);
  }

  console.log("Successfully updated existing stores in the database!");
}

updateStores();
