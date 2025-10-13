-- Add missing image columns to restaurants table
ALTER TABLE mesaclik.restaurants 
ADD COLUMN IF NOT EXISTS hero_image_url TEXT,
ADD COLUMN IF NOT EXISTS final_screen_image_url TEXT;

-- Ensure updated_at trigger exists
CREATE OR REPLACE FUNCTION mesaclik.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_restaurants_updated_at ON mesaclik.restaurants;
CREATE TRIGGER update_restaurants_updated_at
  BEFORE UPDATE ON mesaclik.restaurants
  FOR EACH ROW
  EXECUTE FUNCTION mesaclik.update_updated_at_column();

-- Enable full replica identity for realtime updates
ALTER TABLE mesaclik.restaurants REPLICA IDENTITY FULL;

-- Create storage bucket for restaurant images (if not exists)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'restaurants',
  'restaurants',
  true,
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- Drop existing policies if they exist to avoid conflicts
DROP POLICY IF EXISTS "Public can view restaurant images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload restaurant images" ON storage.objects;
DROP POLICY IF EXISTS "Owners can update their restaurant images" ON storage.objects;
DROP POLICY IF EXISTS "Owners can delete their restaurant images" ON storage.objects;

-- Storage policies for restaurants bucket
CREATE POLICY "Public can view restaurant images"
ON storage.objects FOR SELECT
USING (bucket_id = 'restaurants');

CREATE POLICY "Authenticated users can upload restaurant images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'restaurants' 
  AND auth.uid() IS NOT NULL
);

CREATE POLICY "Owners can update their restaurant images"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'restaurants' 
  AND auth.uid() IS NOT NULL
);

CREATE POLICY "Owners can delete their restaurant images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'restaurants' 
  AND auth.uid() IS NOT NULL
);