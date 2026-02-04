-- Tighten the dev policies to avoid "USING (true)" / "WITH CHECK (true)" warnings.
-- This keeps access scoped to the current dev restaurant only.

DO $$ BEGIN
  -- no-op block to allow re-run safely
END $$;

-- Replace video_jobs policies
DROP POLICY IF EXISTS "video_jobs_select_public" ON public.video_jobs;
DROP POLICY IF EXISTS "video_jobs_insert_public" ON public.video_jobs;
DROP POLICY IF EXISTS "video_jobs_update_public" ON public.video_jobs;
DROP POLICY IF EXISTS "video_jobs_delete_public" ON public.video_jobs;

CREATE POLICY "video_jobs_select_dev_restaurant"
ON public.video_jobs
FOR SELECT
USING (restaurant_id = '8e5d4e30-3432-410a-bcd2-35a4fb5b8e9f');

CREATE POLICY "video_jobs_insert_dev_restaurant"
ON public.video_jobs
FOR INSERT
WITH CHECK (restaurant_id = '8e5d4e30-3432-410a-bcd2-35a4fb5b8e9f');

CREATE POLICY "video_jobs_update_dev_restaurant"
ON public.video_jobs
FOR UPDATE
USING (restaurant_id = '8e5d4e30-3432-410a-bcd2-35a4fb5b8e9f')
WITH CHECK (restaurant_id = '8e5d4e30-3432-410a-bcd2-35a4fb5b8e9f');

CREATE POLICY "video_jobs_delete_dev_restaurant"
ON public.video_jobs
FOR DELETE
USING (restaurant_id = '8e5d4e30-3432-410a-bcd2-35a4fb5b8e9f');

-- Replace video_usage select policy
DROP POLICY IF EXISTS "video_usage_select_public" ON public.video_usage;

CREATE POLICY "video_usage_select_dev_restaurant"
ON public.video_usage
FOR SELECT
USING (restaurant_id = '8e5d4e30-3432-410a-bcd2-35a4fb5b8e9f');
