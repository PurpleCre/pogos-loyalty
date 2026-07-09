ALTER TABLE public.stores
ADD COLUMN image_url TEXT;

-- Update the existing stores with the mock images
UPDATE public.stores SET image_url = 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=500&q=80' WHERE name = 'Pogo''s Main St.';
UPDATE public.stores SET image_url = 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=500&q=80' WHERE name = 'Pogo''s Downtown';
UPDATE public.stores SET image_url = 'https://images.unsplash.com/photo-1552566626-52f8b828add9?w=500&q=80' WHERE name = 'Pogo''s Uptown';
UPDATE public.stores SET image_url = 'https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=500&q=80' WHERE name = 'Pogo''s Suburban';
