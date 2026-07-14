ALTER TABLE public.achievements ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
