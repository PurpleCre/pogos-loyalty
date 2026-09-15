-- Migration: Create user_locations table for saving delivery addresses

CREATE TABLE IF NOT EXISTS public.user_locations (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    address TEXT NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    tag TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.user_locations ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their own locations" 
ON public.user_locations FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own locations" 
ON public.user_locations FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own locations" 
ON public.user_locations FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own locations" 
ON public.user_locations FOR DELETE 
USING (auth.uid() = user_id);

-- Add trigger for updated_at
CREATE OR REPLACE FUNCTION update_user_locations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_user_locations_updated_at ON public.user_locations;

CREATE TRIGGER trigger_user_locations_updated_at
BEFORE UPDATE ON public.user_locations
FOR EACH ROW
EXECUTE FUNCTION update_user_locations_updated_at();
