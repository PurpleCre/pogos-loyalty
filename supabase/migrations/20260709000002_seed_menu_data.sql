-- Create some dummy categories if none exist
INSERT INTO public.menu_categories (id, name, sort_order) 
VALUES 
  ('11111111-1111-1111-1111-111111111111', 'Signatures', 1),
  ('22222222-2222-2222-2222-222222222222', 'Sides & Drinks', 2)
ON CONFLICT DO NOTHING;

-- Create some universal products (store_id is NULL) so they show up at all stores
INSERT INTO public.menu_items (id, category_id, name, description, price, image_url, is_available, store_id)
VALUES
  ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 'Universal Classic Burger', 'A delicious classic burger available everywhere', 10.99, 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd', true, NULL),
  ('44444444-4444-4444-4444-444444444444', '22222222-2222-2222-2222-222222222222', 'Crispy Fries', 'Perfectly salted french fries', 4.99, 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877', true, NULL)
ON CONFLICT DO NOTHING;
