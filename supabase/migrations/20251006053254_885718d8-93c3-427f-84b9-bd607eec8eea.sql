-- Create point gifts table for peer-to-peer point transfers
CREATE TABLE public.point_gifts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id UUID NOT NULL,
  recipient_id UUID NOT NULL,
  points INTEGER NOT NULL CHECK (points > 0),
  message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('completed', 'pending', 'rejected'))
);

-- Enable RLS
ALTER TABLE public.point_gifts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for point_gifts
CREATE POLICY "Users can view gifts they sent"
ON public.point_gifts
FOR SELECT
USING (auth.uid() = sender_id);

CREATE POLICY "Users can view gifts they received"
ON public.point_gifts
FOR SELECT
USING (auth.uid() = recipient_id);

CREATE POLICY "Users can send gifts"
ON public.point_gifts
FOR INSERT
WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "Admins can view all gifts"
ON public.point_gifts
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create announcements table
CREATE TABLE public.announcements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'info' CHECK (type IN ('info', 'success', 'warning', 'promotion')),
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE,
  active BOOLEAN NOT NULL DEFAULT true
);

-- Enable RLS
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

-- RLS Policies for announcements
CREATE POLICY "Anyone can view active announcements"
ON public.announcements
FOR SELECT
USING (active = true AND (expires_at IS NULL OR expires_at > now()));

CREATE POLICY "Admins can manage announcements"
ON public.announcements
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create indexes for better performance
CREATE INDEX idx_point_gifts_sender ON public.point_gifts(sender_id);
CREATE INDEX idx_point_gifts_recipient ON public.point_gifts(recipient_id);
CREATE INDEX idx_announcements_active ON public.announcements(active, expires_at);