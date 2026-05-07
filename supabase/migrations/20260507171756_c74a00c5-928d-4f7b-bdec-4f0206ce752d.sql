
-- Tabela de fotos do ambiente
CREATE TABLE IF NOT EXISTS public.restaurant_ambient_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  photo_url text NOT NULL,
  source text NOT NULL DEFAULT 'manual' CHECK (source IN ('google','manual')),
  position int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ambient_photos_restaurant ON public.restaurant_ambient_photos(restaurant_id, position);

ALTER TABLE public.restaurant_ambient_photos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view ambient photos" ON public.restaurant_ambient_photos;
CREATE POLICY "Members can view ambient photos"
ON public.restaurant_ambient_photos FOR SELECT
TO authenticated
USING (public.is_member_or_admin(restaurant_id) OR public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Members can insert ambient photos" ON public.restaurant_ambient_photos;
CREATE POLICY "Members can insert ambient photos"
ON public.restaurant_ambient_photos FOR INSERT
TO authenticated
WITH CHECK (public.is_member_or_admin(restaurant_id) OR public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Members can delete ambient photos" ON public.restaurant_ambient_photos;
CREATE POLICY "Members can delete ambient photos"
ON public.restaurant_ambient_photos FOR DELETE
TO authenticated
USING (public.is_member_or_admin(restaurant_id) OR public.is_admin(auth.uid()));

-- Bucket público para fotos de ambiente
INSERT INTO storage.buckets (id, name, public)
VALUES ('ambient-photos', 'ambient-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Policies do storage
DROP POLICY IF EXISTS "Public read ambient photos" ON storage.objects;
CREATE POLICY "Public read ambient photos"
ON storage.objects FOR SELECT
USING (bucket_id = 'ambient-photos');

DROP POLICY IF EXISTS "Members upload ambient photos" ON storage.objects;
CREATE POLICY "Members upload ambient photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'ambient-photos'
  AND (
    public.is_admin(auth.uid())
    OR public.is_member_or_admin(((storage.foldername(name))[1])::uuid)
  )
);

DROP POLICY IF EXISTS "Members delete ambient photos" ON storage.objects;
CREATE POLICY "Members delete ambient photos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'ambient-photos'
  AND (
    public.is_admin(auth.uid())
    OR public.is_member_or_admin(((storage.foldername(name))[1])::uuid)
  )
);
