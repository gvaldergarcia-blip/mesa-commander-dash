-- Allow the frontend (anon/authenticated) to read video jobs/usage so they appear in the UI.
-- NOTE: This is permissive (dev-style). Tighten policies for production.

ALTER TABLE public.video_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.video_usage ENABLE ROW LEVEL SECURITY;

-- video_jobs policies
DROP POLICY IF EXISTS "video_jobs_select_public" ON public.video_jobs;
DROP POLICY IF EXISTS "video_jobs_insert_public" ON public.video_jobs;
DROP POLICY IF EXISTS "video_jobs_update_public" ON public.video_jobs;
DROP POLICY IF EXISTS "video_jobs_delete_public" ON public.video_jobs;

CREATE POLICY "video_jobs_select_public"
ON public.video_jobs
FOR SELECT
USING (true);

CREATE POLICY "video_jobs_insert_public"
ON public.video_jobs
FOR INSERT
WITH CHECK (true);

CREATE POLICY "video_jobs_update_public"
ON public.video_jobs
FOR UPDATE
USING (true)
WITH CHECK (true);

CREATE POLICY "video_jobs_delete_public"
ON public.video_jobs
FOR DELETE
USING (true);

-- video_usage policies (read-only from frontend)
DROP POLICY IF EXISTS "video_usage_select_public" ON public.video_usage;

CREATE POLICY "video_usage_select_public"
ON public.video_usage
FOR SELECT
USING (true);
