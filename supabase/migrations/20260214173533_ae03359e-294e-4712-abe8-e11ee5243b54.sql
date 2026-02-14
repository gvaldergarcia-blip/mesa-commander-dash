
-- Create marketing_posts table
CREATE TABLE public.marketing_posts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id UUID NOT NULL,
  user_id UUID,
  type TEXT NOT NULL CHECK (type IN ('fila', 'reserva', 'promo', 'destaque', 'evento')),
  format TEXT NOT NULL CHECK (format IN ('square', 'story')),
  headline TEXT NOT NULL,
  subtext TEXT,
  cta TEXT,
  template_id TEXT DEFAULT 'gradient_warm',
  image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.marketing_posts ENABLE ROW LEVEL SECURITY;

-- RLS: restaurant members can view their own posts
CREATE POLICY "Members can view restaurant marketing posts"
ON public.marketing_posts FOR SELECT
USING (public.is_member_of(restaurant_id));

-- RLS: members can insert posts for their restaurant
CREATE POLICY "Members can create marketing posts"
ON public.marketing_posts FOR INSERT
WITH CHECK (public.is_member_of(restaurant_id));

-- RLS: members can delete their restaurant posts
CREATE POLICY "Members can delete marketing posts"
ON public.marketing_posts FOR DELETE
USING (public.is_member_of(restaurant_id));

-- Create storage bucket for marketing assets
INSERT INTO storage.buckets (id, name, public)
VALUES ('marketing_assets', 'marketing_assets', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Public can view marketing assets"
ON storage.objects FOR SELECT
USING (bucket_id = 'marketing_assets');

CREATE POLICY "Authenticated users can upload marketing assets"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'marketing_assets' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete marketing assets"
ON storage.objects FOR DELETE
USING (bucket_id = 'marketing_assets' AND auth.role() = 'authenticated');
