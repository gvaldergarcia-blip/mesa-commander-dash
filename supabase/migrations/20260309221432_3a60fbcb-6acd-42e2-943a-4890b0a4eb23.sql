
CREATE TABLE public.generated_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL,
  post_type text NOT NULL,
  layout text NOT NULL DEFAULT 'impacto',
  copy_data jsonb NOT NULL DEFAULT '{}',
  image_upload_url text,
  image_final_url text,
  dish_name text,
  validity text,
  tone text,
  price_old numeric,
  price_new numeric,
  discount_percent numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  published boolean NOT NULL DEFAULT false,
  published_at timestamptz
);

ALTER TABLE public.generated_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view own restaurant posts"
  ON public.generated_posts FOR SELECT
  TO authenticated
  USING (restaurant_id IN (
    SELECT restaurant_id FROM public.restaurant_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "Members can insert posts"
  ON public.generated_posts FOR INSERT
  TO authenticated
  WITH CHECK (restaurant_id IN (
    SELECT restaurant_id FROM public.restaurant_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "Members can update own restaurant posts"
  ON public.generated_posts FOR UPDATE
  TO authenticated
  USING (restaurant_id IN (
    SELECT restaurant_id FROM public.restaurant_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "Members can delete own restaurant posts"
  ON public.generated_posts FOR DELETE
  TO authenticated
  USING (restaurant_id IN (
    SELECT restaurant_id FROM public.restaurant_members WHERE user_id = auth.uid()
  ));
