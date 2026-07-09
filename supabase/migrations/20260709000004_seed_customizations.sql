-- Patty Option
INSERT INTO public.menu_item_options (id, menu_item_id, name, is_required, max_choices, sort_order)
VALUES ('55555555-5555-5555-5555-555555555551', '33333333-3333-3333-3333-333333333333', 'Choose Patty', true, 1, 1)
ON CONFLICT DO NOTHING;

INSERT INTO public.menu_item_option_choices (option_id, name, price_adjustment, is_default, sort_order)
VALUES 
  ('55555555-5555-5555-5555-555555555551', 'Beef', 0, true, 1),
  ('55555555-5555-5555-5555-555555555551', 'Chicken', 0, false, 2),
  ('55555555-5555-5555-5555-555555555551', 'Veggie', 1.00, false, 3);

-- Toppings Option
INSERT INTO public.menu_item_options (id, menu_item_id, name, is_required, max_choices, sort_order)
VALUES ('55555555-5555-5555-5555-555555555552', '33333333-3333-3333-3333-333333333333', 'Toppings', false, 10, 2)
ON CONFLICT DO NOTHING;

INSERT INTO public.menu_item_option_choices (option_id, name, price_adjustment, is_default, sort_order)
VALUES 
  ('55555555-5555-5555-5555-555555555552', 'Pickles', 0, false, 1),
  ('55555555-5555-5555-5555-555555555552', 'Onions', 0, false, 2),
  ('55555555-5555-5555-5555-555555555552', 'Bacon', 1.50, false, 3),
  ('55555555-5555-5555-5555-555555555552', 'Extra Cheese', 1.00, false, 4);

-- Sauces Option
INSERT INTO public.menu_item_options (id, menu_item_id, name, is_required, max_choices, sort_order)
VALUES ('55555555-5555-5555-5555-555555555553', '33333333-3333-3333-3333-333333333333', 'Sauces', false, 5, 3)
ON CONFLICT DO NOTHING;

INSERT INTO public.menu_item_option_choices (option_id, name, price_adjustment, is_default, sort_order)
VALUES 
  ('55555555-5555-5555-5555-555555555553', 'Ketchup', 0, false, 1),
  ('55555555-5555-5555-5555-555555555553', 'Mustard', 0, false, 2),
  ('55555555-5555-5555-5555-555555555553', 'BBQ', 0.50, false, 3),
  ('55555555-5555-5555-5555-555555555553', 'Mayo', 0, false, 4);
