
-- ============= 1. ENUM categoria de prato =============
DO $$ BEGIN
  CREATE TYPE public.dish_category AS ENUM ('entrada','prato_principal','sobremesa','bebida','outro');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.social_suggestion_status AS ENUM ('pending','approved','dismissed','posted');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.social_chat_role AS ENUM ('user','ai','system');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============= 2. Colunas novas em restaurants =============
ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS social_autopilot_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS social_autopilot_categories text[] NOT NULL DEFAULT ARRAY['prato_principal']::text[],
  ADD COLUMN IF NOT EXISTS menu_dishes_extracted_at timestamptz;

-- ============= 3. Tabela restaurant_dishes =============
CREATE TABLE IF NOT EXISTS public.restaurant_dishes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  price numeric(10,2),
  category public.dish_category NOT NULL DEFAULT 'outro',
  dish_photo_url text,
  is_featured boolean NOT NULL DEFAULT false,
  times_used_in_posts integer NOT NULL DEFAULT 0,
  last_used_at timestamptz,
  source text NOT NULL DEFAULT 'menu_extraction', -- menu_extraction | manual
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_dishes_restaurant ON public.restaurant_dishes(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_dishes_rotation ON public.restaurant_dishes(restaurant_id, is_featured, last_used_at NULLS FIRST) WHERE dish_photo_url IS NOT NULL;

ALTER TABLE public.restaurant_dishes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view dishes"
ON public.restaurant_dishes FOR SELECT TO authenticated
USING (public.is_member_or_admin(restaurant_id));

CREATE POLICY "Admins can manage dishes"
ON public.restaurant_dishes FOR ALL TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = restaurant_id AND r.owner_id = auth.uid())
  OR public.is_admin(auth.uid())
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = restaurant_id AND r.owner_id = auth.uid())
  OR public.is_admin(auth.uid())
);

-- ============= 4. Tabela social_post_suggestions =============
CREATE TABLE IF NOT EXISTS public.social_post_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  dish_id uuid REFERENCES public.restaurant_dishes(id) ON DELETE SET NULL,
  suggested_for_date date NOT NULL DEFAULT (now() AT TIME ZONE 'America/Sao_Paulo')::date,
  status public.social_suggestion_status NOT NULL DEFAULT 'pending',
  context_data jsonb NOT NULL DEFAULT '{}'::jsonb, -- {dia_semana, lotacao_recente, motivo}
  copy_text text,
  current_version_id uuid, -- FK adicionada depois (circular)
  approved_at timestamptz,
  posted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_suggestions_restaurant_status ON public.social_post_suggestions(restaurant_id, status, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS uq_suggestion_one_per_day
  ON public.social_post_suggestions(restaurant_id, suggested_for_date)
  WHERE status IN ('pending','approved');

ALTER TABLE public.social_post_suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view suggestions"
ON public.social_post_suggestions FOR SELECT TO authenticated
USING (public.is_member_or_admin(restaurant_id));

CREATE POLICY "Admins can manage suggestions"
ON public.social_post_suggestions FOR ALL TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = restaurant_id AND r.owner_id = auth.uid())
  OR public.is_admin(auth.uid())
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = restaurant_id AND r.owner_id = auth.uid())
  OR public.is_admin(auth.uid())
);

-- ============= 5. Tabela social_post_versions =============
CREATE TABLE IF NOT EXISTS public.social_post_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  suggestion_id uuid NOT NULL REFERENCES public.social_post_suggestions(id) ON DELETE CASCADE,
  version_number integer NOT NULL,
  image_url text NOT NULL,
  prompt_used text,
  edit_instruction text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (suggestion_id, version_number)
);
CREATE INDEX IF NOT EXISTS idx_versions_suggestion ON public.social_post_versions(suggestion_id, version_number DESC);

ALTER TABLE public.social_post_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view versions"
ON public.social_post_versions FOR SELECT TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.social_post_suggestions s
          WHERE s.id = suggestion_id AND public.is_member_or_admin(s.restaurant_id))
);

CREATE POLICY "Admins can manage versions"
ON public.social_post_versions FOR ALL TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.social_post_suggestions s
          JOIN public.restaurants r ON r.id = s.restaurant_id
          WHERE s.id = suggestion_id AND (r.owner_id = auth.uid() OR public.is_admin(auth.uid())))
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.social_post_suggestions s
          JOIN public.restaurants r ON r.id = s.restaurant_id
          WHERE s.id = suggestion_id AND (r.owner_id = auth.uid() OR public.is_admin(auth.uid())))
);

-- FK circular agora que ambas existem
ALTER TABLE public.social_post_suggestions
  DROP CONSTRAINT IF EXISTS fk_current_version;
ALTER TABLE public.social_post_suggestions
  ADD CONSTRAINT fk_current_version
  FOREIGN KEY (current_version_id) REFERENCES public.social_post_versions(id) ON DELETE SET NULL;

-- ============= 6. Tabela social_post_chat_messages =============
CREATE TABLE IF NOT EXISTS public.social_post_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  suggestion_id uuid NOT NULL REFERENCES public.social_post_suggestions(id) ON DELETE CASCADE,
  role public.social_chat_role NOT NULL,
  content text NOT NULL,
  version_id uuid REFERENCES public.social_post_versions(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_chat_suggestion ON public.social_post_chat_messages(suggestion_id, created_at);

ALTER TABLE public.social_post_chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view chat"
ON public.social_post_chat_messages FOR SELECT TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.social_post_suggestions s
          WHERE s.id = suggestion_id AND public.is_member_or_admin(s.restaurant_id))
);

CREATE POLICY "Admins can manage chat"
ON public.social_post_chat_messages FOR ALL TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.social_post_suggestions s
          JOIN public.restaurants r ON r.id = s.restaurant_id
          WHERE s.id = suggestion_id AND (r.owner_id = auth.uid() OR public.is_admin(auth.uid())))
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.social_post_suggestions s
          JOIN public.restaurants r ON r.id = s.restaurant_id
          WHERE s.id = suggestion_id AND (r.owner_id = auth.uid() OR public.is_admin(auth.uid())))
);

-- ============= 7. updated_at triggers =============
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS trg_dishes_updated ON public.restaurant_dishes;
CREATE TRIGGER trg_dishes_updated BEFORE UPDATE ON public.restaurant_dishes
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_suggestions_updated ON public.social_post_suggestions;
CREATE TRIGGER trg_suggestions_updated BEFORE UPDATE ON public.social_post_suggestions
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============= 8. Storage bucket dish-photos =============
INSERT INTO storage.buckets (id, name, public)
VALUES ('dish-photos', 'dish-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Public read
DROP POLICY IF EXISTS "Dish photos public read" ON storage.objects;
CREATE POLICY "Dish photos public read"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'dish-photos');

-- Members upload (path prefixed by restaurant_id)
DROP POLICY IF EXISTS "Members upload dish photos" ON storage.objects;
CREATE POLICY "Members upload dish photos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'dish-photos'
  AND public.is_member_or_admin(((storage.foldername(name))[1])::uuid)
);

DROP POLICY IF EXISTS "Members update dish photos" ON storage.objects;
CREATE POLICY "Members update dish photos"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'dish-photos'
  AND public.is_member_or_admin(((storage.foldername(name))[1])::uuid)
);

DROP POLICY IF EXISTS "Members delete dish photos" ON storage.objects;
CREATE POLICY "Members delete dish photos"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'dish-photos'
  AND public.is_member_or_admin(((storage.foldername(name))[1])::uuid)
);
