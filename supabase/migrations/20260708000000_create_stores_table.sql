CREATE TABLE IF NOT EXISTS public.stores (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    address TEXT NOT NULL,
    distance_miles NUMERIC NOT NULL,
    is_open BOOLEAN NOT NULL DEFAULT true,
    latitude NUMERIC,
    longitude NUMERIC,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;

-- Allow public read access
CREATE POLICY "Allow public read access to stores"
ON public.stores FOR SELECT
USING (true);

-- Insert mock data
INSERT INTO public.stores (name, address, distance_miles, is_open, latitude, longitude) VALUES
('Pogo''s Main St.', '123 Main St, City Center', 1.2, true, 40.7128, -74.0060),
('Pogo''s Downtown', '456 Market St, Downtown', 3.1, true, 40.7282, -73.9942),
('Pogo''s Uptown', '789 Park Ave, Uptown', 4.5, true, 40.7589, -73.9851),
('Pogo''s Suburban', '101 Mall Rd, Suburbia', 8.9, false, 40.8500, -73.8667);
