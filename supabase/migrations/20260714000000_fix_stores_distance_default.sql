-- Add default value to distance_miles so admin-created stores don't fail
ALTER TABLE public.stores ALTER COLUMN distance_miles SET DEFAULT 0;

-- Also add image_url column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'stores' AND column_name = 'image_url'
    ) THEN
        ALTER TABLE public.stores ADD COLUMN image_url TEXT;
    END IF;
END $$;

-- Allow admins to manage stores (insert, update, delete)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'Allow admin manage stores'
    ) THEN
        CREATE POLICY "Allow admin manage stores"
        ON public.stores FOR ALL
        USING (
            EXISTS (
                SELECT 1 FROM public.user_roles
                WHERE user_roles.user_id = auth.uid()
                AND user_roles.role = 'admin'
            )
        );
    END IF;
END $$;
