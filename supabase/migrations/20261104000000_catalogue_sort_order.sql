-- Keep the confirmed Pogo's menu sequence consistent online and in browse caches.
-- Catalogue data replacement is an explicit development operation, not a reset
-- hidden inside a reusable schema migration.
ALTER TABLE public.menu_items ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS menu_items_category_sort_idx ON public.menu_items(category_id,sort_order,name,id);
