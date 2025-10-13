-- Create RLS policies for restaurants storage bucket
-- Allow public read access to all files
CREATE POLICY "Public read access to restaurants bucket"
ON storage.objects FOR SELECT
USING (bucket_id = 'restaurants');

-- Allow authenticated and unauthenticated users to insert files
CREATE POLICY "Allow insert to restaurants bucket"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'restaurants');

-- Allow update to restaurants bucket
CREATE POLICY "Allow update to restaurants bucket"
ON storage.objects FOR UPDATE
USING (bucket_id = 'restaurants')
WITH CHECK (bucket_id = 'restaurants');

-- Allow delete from restaurants bucket
CREATE POLICY "Allow delete from restaurants bucket"
ON storage.objects FOR DELETE
USING (bucket_id = 'restaurants');