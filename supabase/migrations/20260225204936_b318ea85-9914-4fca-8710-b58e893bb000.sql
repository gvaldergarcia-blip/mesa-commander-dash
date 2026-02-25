
-- Create promotions_assets table for campaign history
CREATE TABLE public.promotions_assets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  campaign_type TEXT NOT NULL DEFAULT 'sem_desconto',
  dish_name TEXT NOT NULL,
  original_price NUMERIC NULL,
  promo_price NUMERIC NULL,
  discount_percent INTEGER NULL,
  campaign_goal TEXT NULL,
  campaign_day TEXT NULL,
  target_audience TEXT NULL,
  brand_tone TEXT NULL,
  include_logo BOOLEAN NOT NULL DEFAULT false,
  include_address BOOLEAN NOT NULL DEFAULT false,
  image_url TEXT NULL,
  caption_text TEXT NULL,
  status TEXT NOT NULL DEFAULT 'success',
  reference_image_used BOOLEAN NOT NULL DEFAULT false
);

-- Enable RLS
ALTER TABLE public.promotions_assets ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "promotions_assets_tenant_select"
ON public.promotions_assets FOR SELECT
USING (is_member_or_admin(restaurant_id));

CREATE POLICY "promotions_assets_tenant_insert"
ON public.promotions_assets FOR INSERT
WITH CHECK (is_member_or_admin(restaurant_id));

CREATE POLICY "promotions_assets_tenant_delete"
ON public.promotions_assets FOR DELETE
USING (is_member_or_admin(restaurant_id));

-- Index for gallery queries
CREATE INDEX idx_promotions_assets_restaurant ON public.promotions_assets(restaurant_id, created_at DESC);
