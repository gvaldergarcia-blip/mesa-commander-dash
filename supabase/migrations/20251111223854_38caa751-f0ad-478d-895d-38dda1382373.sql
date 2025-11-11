-- Create storage bucket for paid coupons
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'coupons',
  'coupons',
  true,
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/png', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for coupons bucket
CREATE POLICY "Restaurants can upload their own coupon files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'coupons' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Anyone can view public coupon files"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'coupons');

CREATE POLICY "Restaurants can update their own coupon files"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'coupons' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Restaurants can delete their own coupon files"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'coupons' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Update coupons table to add coupon_type and file_url
ALTER TABLE mesaclik.coupons
ADD COLUMN IF NOT EXISTS coupon_type TEXT CHECK (coupon_type IN ('link', 'upload')) DEFAULT 'link',
ADD COLUMN IF NOT EXISTS file_url TEXT;

-- Add payment status tracking
ALTER TABLE mesaclik.coupons
ADD COLUMN IF NOT EXISTS payment_status TEXT CHECK (payment_status IN ('pending', 'completed', 'failed', 'refunded')) DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS payment_method TEXT,
ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;