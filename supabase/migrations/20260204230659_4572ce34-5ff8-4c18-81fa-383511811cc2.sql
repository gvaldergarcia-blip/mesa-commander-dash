-- Drop existing restrictive policies on videos bucket
DROP POLICY IF EXISTS "Authenticated users can upload videos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update their videos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete their videos" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view videos" ON storage.objects;

-- Create permissive policies for videos bucket
CREATE POLICY "Anyone can upload to videos bucket"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'videos');

CREATE POLICY "Anyone can view videos bucket"
ON storage.objects FOR SELECT
USING (bucket_id = 'videos');

CREATE POLICY "Anyone can update videos bucket"
ON storage.objects FOR UPDATE
USING (bucket_id = 'videos');

CREATE POLICY "Anyone can delete from videos bucket"
ON storage.objects FOR DELETE
USING (bucket_id = 'videos');