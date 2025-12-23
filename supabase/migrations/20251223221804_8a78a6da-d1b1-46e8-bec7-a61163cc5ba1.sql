-- DEV ONLY: Permitir upload anônimo no bucket restaurants para desenvolvimento
CREATE POLICY "Dev allow anonymous upload to restaurants"
ON storage.objects
FOR INSERT
TO anon
WITH CHECK (bucket_id = 'restaurants');