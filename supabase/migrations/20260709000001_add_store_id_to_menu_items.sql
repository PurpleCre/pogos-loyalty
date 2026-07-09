ALTER TABLE public.menu_items
ADD COLUMN store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE;

-- Update RLS policies for menu_items if needed (usually it's public read, but just in case)
-- This allows items to be filtered by store_id without errors
