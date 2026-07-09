-- Insert More Categories
INSERT INTO public.menu_categories (id, name, sort_order) 
VALUES 
  ('11111111-1111-1111-1111-111111111113', 'Burgers', 3),
  ('11111111-1111-1111-1111-111111111114', 'Drinks', 4),
  ('11111111-1111-1111-1111-111111111115', 'Combos', 5),
  ('11111111-1111-1111-1111-111111111116', 'Local Specials', 6)
ON CONFLICT (id) DO NOTHING;

-- Insert More Products
INSERT INTO public.menu_items (id, category_id, name, description, price, image_url, is_available, store_id)
VALUES 
  -- Burgers
  ('33333333-3333-3333-3333-333333333335', '11111111-1111-1111-1111-111111111113', 'Double Bacon Smash', 'Two smashed patties with crispy bacon and melted cheddar.', 14.99, 'https://images.unsplash.com/photo-1594212202878-8cb6d50ff90e?w=800&q=80', true, NULL),
  ('33333333-3333-3333-3333-333333333336', '11111111-1111-1111-1111-111111111113', 'Spicy Jalapeno Burger', 'Pepper jack, jalapenos, and spicy mayo.', 13.49, 'https://images.unsplash.com/photo-1586190848861-99aa4a171e90?w=800&q=80', true, NULL),
  
  -- Drinks
  ('33333333-3333-3333-3333-333333333337', '11111111-1111-1111-1111-111111111114', 'Classic Cola', 'Ice cold classic soda.', 2.99, 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=800&q=80', true, NULL),
  ('33333333-3333-3333-3333-333333333338', '11111111-1111-1111-1111-111111111114', 'Strawberry Shake', 'Thick hand-spun strawberry milkshake.', 5.99, 'https://images.unsplash.com/photo-1572490122747-3968b75bb8ef?w=800&q=80', true, NULL),

  -- Combos
  ('33333333-3333-3333-3333-333333333339', '11111111-1111-1111-1111-111111111115', 'The Pogo Meal', 'Signature burger, medium fries, and a drink.', 16.99, 'https://images.unsplash.com/photo-1550547660-d9450f859349?w=800&q=80', true, NULL),
  
  -- Specials
  ('33333333-3333-3333-3333-333333333340', '11111111-1111-1111-1111-111111111116', 'Truffle Fries', 'Crispy fries tossed in truffle oil and parmesan.', 6.49, 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=800&q=80', true, NULL)
ON CONFLICT (id) DO NOTHING;

-- Attach custom options to the Double Bacon Smash Burger so it shows the bottom sheet too
INSERT INTO public.menu_item_options (id, menu_item_id, name, is_required, max_choices, sort_order)
VALUES ('55555555-5555-5555-5555-555555555555', '33333333-3333-3333-3333-333333333335', 'Choose Patty', true, 1, 1)
ON CONFLICT DO NOTHING;

INSERT INTO public.menu_item_option_choices (option_id, name, price_adjustment, is_default, sort_order)
VALUES 
  ('55555555-5555-5555-5555-555555555555', 'Beef', 0, true, 1),
  ('55555555-5555-5555-5555-555555555555', 'Chicken', 0, false, 2);
