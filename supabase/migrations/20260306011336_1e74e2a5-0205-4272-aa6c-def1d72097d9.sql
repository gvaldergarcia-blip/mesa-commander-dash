-- FINDING 2: Restrict customers SELECT to tenant-scoped
DROP POLICY IF EXISTS "customers_tenant_select" ON public.customers;

CREATE POLICY "customers_tenant_select" ON public.customers
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.restaurant_customers rc
      JOIN public.restaurant_members rm ON rm.restaurant_id = rc.restaurant_id
      WHERE rc.customer_phone = customers.phone
        AND rm.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.restaurant_customers rc
      JOIN public.restaurant_members rm ON rm.restaurant_id = rc.restaurant_id
      WHERE rc.customer_email = customers.email
        AND rm.user_id = auth.uid()
        AND customers.email IS NOT NULL
    )
    OR public.has_role(auth.uid(), 'admin'::app_role)
  );

DROP POLICY IF EXISTS "customers_tenant_update" ON public.customers;

CREATE POLICY "customers_tenant_update" ON public.customers
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.restaurant_customers rc
      JOIN public.restaurant_members rm ON rm.restaurant_id = rc.restaurant_id
      WHERE (rc.customer_phone = customers.phone OR (rc.customer_email = customers.email AND customers.email IS NOT NULL))
        AND rm.user_id = auth.uid()
    )
    OR public.has_role(auth.uid(), 'admin'::app_role)
  );

-- FINDING 3: Restrict founder_leads to platform super-admins
CREATE TABLE IF NOT EXISTS public.platform_admins (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID
);

ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "platform_admins_self_read" ON public.platform_admins
    FOR SELECT TO authenticated USING (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

INSERT INTO public.platform_admins (user_id)
SELECT DISTINCT ur.user_id FROM public.user_roles ur WHERE ur.role = 'admin'
ON CONFLICT (user_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = auth.uid()); $$;

DROP POLICY IF EXISTS "Admin can manage founder_leads" ON public.founder_leads;
DROP POLICY IF EXISTS "User can view own founder lead" ON public.founder_leads;

CREATE POLICY "platform_admin_manage_founder_leads" ON public.founder_leads
  FOR ALL TO authenticated
  USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());

CREATE POLICY "user_view_own_founder_lead" ON public.founder_leads
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- FINDING 4: Storage bucket ownership policies

-- promotion-images INSERT
DROP POLICY IF EXISTS "Authenticated users can upload promotion images" ON storage.objects;
DROP POLICY IF EXISTS "promotion_images_member_insert" ON storage.objects;

CREATE POLICY "promotion_images_member_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'promotion-images' AND auth.uid() IS NOT NULL
    AND (
      EXISTS (SELECT 1 FROM public.restaurant_members WHERE user_id = auth.uid() AND restaurant_id::text = (storage.foldername(name))[1])
      OR EXISTS (SELECT 1 FROM public.restaurants WHERE owner_id = auth.uid() AND id::text = (storage.foldername(name))[1])
      OR public.has_role(auth.uid(), 'admin'::app_role)
    )
  );

-- promotion-images UPDATE
DROP POLICY IF EXISTS "Authenticated users can update promotion images" ON storage.objects;
DROP POLICY IF EXISTS "promotion_images_member_update" ON storage.objects;

CREATE POLICY "promotion_images_member_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'promotion-images'
    AND (
      EXISTS (SELECT 1 FROM public.restaurant_members WHERE user_id = auth.uid() AND restaurant_id::text = (storage.foldername(name))[1])
      OR EXISTS (SELECT 1 FROM public.restaurants WHERE owner_id = auth.uid() AND id::text = (storage.foldername(name))[1])
      OR public.has_role(auth.uid(), 'admin'::app_role)
    )
  );

-- marketing-videos INSERT
DROP POLICY IF EXISTS "marketing_videos_auth_upload" ON storage.objects;
DROP POLICY IF EXISTS "marketing_videos_member_insert" ON storage.objects;

CREATE POLICY "marketing_videos_member_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'marketing-videos' AND auth.uid() IS NOT NULL
    AND (
      EXISTS (SELECT 1 FROM public.restaurant_members WHERE user_id = auth.uid() AND restaurant_id::text = (storage.foldername(name))[1])
      OR EXISTS (SELECT 1 FROM public.restaurants WHERE owner_id = auth.uid() AND id::text = (storage.foldername(name))[1])
      OR public.has_role(auth.uid(), 'admin'::app_role)
    )
  );

-- restaurants bucket INSERT
DROP POLICY IF EXISTS "storage_restaurants_authenticated_insert" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload restaurant files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload restaurant images" ON storage.objects;
DROP POLICY IF EXISTS "Dev allow anonymous upload to restaurants" ON storage.objects;
DROP POLICY IF EXISTS "restaurants_member_insert" ON storage.objects;

CREATE POLICY "restaurants_member_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'restaurants' AND auth.uid() IS NOT NULL
    AND (
      EXISTS (SELECT 1 FROM public.restaurant_members WHERE user_id = auth.uid() AND restaurant_id::text = (storage.foldername(name))[1])
      OR EXISTS (SELECT 1 FROM public.restaurants WHERE owner_id = auth.uid() AND id::text = (storage.foldername(name))[1])
      OR public.has_role(auth.uid(), 'admin'::app_role)
    )
  );

-- videos bucket: lock down write
DROP POLICY IF EXISTS "Anyone can upload to videos bucket" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can update videos bucket" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can delete from videos bucket" ON storage.objects;
DROP POLICY IF EXISTS "videos_member_insert" ON storage.objects;
DROP POLICY IF EXISTS "videos_member_update" ON storage.objects;
DROP POLICY IF EXISTS "videos_member_delete" ON storage.objects;

CREATE POLICY "videos_member_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'videos' AND auth.uid() IS NOT NULL
    AND (
      EXISTS (SELECT 1 FROM public.restaurant_members WHERE user_id = auth.uid() AND restaurant_id::text = (storage.foldername(name))[1])
      OR EXISTS (SELECT 1 FROM public.restaurants WHERE owner_id = auth.uid() AND id::text = (storage.foldername(name))[1])
      OR public.has_role(auth.uid(), 'admin'::app_role)
    )
  );

CREATE POLICY "videos_member_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'videos'
    AND (
      EXISTS (SELECT 1 FROM public.restaurant_members WHERE user_id = auth.uid() AND restaurant_id::text = (storage.foldername(name))[1])
      OR public.has_role(auth.uid(), 'admin'::app_role)
    )
  );

CREATE POLICY "videos_member_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'videos'
    AND (
      EXISTS (SELECT 1 FROM public.restaurant_members WHERE user_id = auth.uid() AND restaurant_id::text = (storage.foldername(name))[1])
      OR public.has_role(auth.uid(), 'admin'::app_role)
    )
  );