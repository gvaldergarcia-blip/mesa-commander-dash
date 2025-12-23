-- Criar política para permitir upload no bucket restaurants
CREATE POLICY "Authenticated users can upload restaurant files"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'restaurants');

-- Criar política para permitir update no bucket restaurants
CREATE POLICY "Authenticated users can update restaurant files"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'restaurants');

-- Criar política para permitir delete no bucket restaurants
CREATE POLICY "Authenticated users can delete restaurant files"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'restaurants');