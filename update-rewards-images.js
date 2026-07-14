const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.secret_key;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const rewardImages = {
  'Free Small Fries': 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=500&q=80',
  'Free Soft Drink': 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=500&q=80',
  'Free Burger': 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=500&q=80',
  '20% Off Next Order': null // Let the frontend render the ticket icon
};

async function updateRewards() {
  const { data: rewards, error: fetchError } = await supabase.from('rewards').select('*');
  
  if (fetchError || !rewards || rewards.length === 0) {
    console.error("Error fetching rewards:", fetchError);
    return;
  }

  for (const reward of rewards) {
    if (rewardImages.hasOwnProperty(reward.name)) {
      const img = rewardImages[reward.name];
      await supabase.from('rewards').update({
        image_url: img
      }).eq('id', reward.id);
      console.log(`Updated ${reward.name} image.`);
    }
  }

  console.log("Successfully updated rewards images in the database!");
}

updateRewards();
