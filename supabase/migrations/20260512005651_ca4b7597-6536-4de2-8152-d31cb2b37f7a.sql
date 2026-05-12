CREATE TABLE IF NOT EXISTS public.menu_dishes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC(10,2),
  category TEXT NOT NULL DEFAULT 'principal',
  ingredients TEXT[] NOT NULL DEFAULT '{}',
  profiles TEXT[] NOT NULL DEFAULT '{}',
  occasions TEXT[] NOT NULL DEFAULT '{}',
  margin TEXT NOT NULL DEFAULT 'media' CHECK (margin IN ('alta','media','baixa')),
  restrictions TEXT[] NOT NULL DEFAULT '{}',
  ai_notes TEXT,
  photo_url TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_menu_dishes_restaurant ON public.menu_dishes(restaurant_id);

ALTER TABLE public.menu_dishes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "menu_dishes_select" ON public.menu_dishes
FOR SELECT USING (public.is_member_or_admin(restaurant_id));
CREATE POLICY "menu_dishes_insert" ON public.menu_dishes
FOR INSERT WITH CHECK (public.is_member_or_admin(restaurant_id));
CREATE POLICY "menu_dishes_update" ON public.menu_dishes
FOR UPDATE USING (public.is_member_or_admin(restaurant_id));
CREATE POLICY "menu_dishes_delete" ON public.menu_dishes
FOR DELETE USING (public.is_member_or_admin(restaurant_id));

CREATE TRIGGER update_menu_dishes_updated_at
BEFORE UPDATE ON public.menu_dishes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO storage.buckets (id, name, public)
VALUES ('dish-photos', 'dish-photos', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "dish_photos_read_public" ON storage.objects
FOR SELECT USING (bucket_id = 'dish-photos');

CREATE POLICY "dish_photos_insert_member" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'dish-photos'
  AND public.is_member_or_admin( ((storage.foldername(name))[1])::uuid )
);

CREATE POLICY "dish_photos_update_member" ON storage.objects
FOR UPDATE USING (
  bucket_id = 'dish-photos'
  AND public.is_member_or_admin( ((storage.foldername(name))[1])::uuid )
);

CREATE POLICY "dish_photos_delete_member" ON storage.objects
FOR DELETE USING (
  bucket_id = 'dish-photos'
  AND public.is_member_or_admin( ((storage.foldername(name))[1])::uuid )
);