
-- Drop existing tables if they exist from old feature
DROP TABLE IF EXISTS public.video_usage CASCADE;
DROP TABLE IF EXISTS public.video_jobs CASCADE;

-- Create video_jobs table
CREATE TABLE public.video_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL,
  user_id uuid,
  format text NOT NULL DEFAULT 'vertical' CHECK (format IN ('vertical', 'square')),
  duration_seconds integer NOT NULL DEFAULT 15 CHECK (duration_seconds IN (7, 15, 30)),
  template_id text NOT NULL DEFAULT 'elegante',
  headline text NOT NULL,
  subtext text,
  cta text,
  music_id text,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'done', 'failed')),
  progress integer DEFAULT 0,
  video_url text,
  thumbnail_url text,
  image_urls text[] NOT NULL DEFAULT '{}',
  logo_url text,
  restaurant_name text,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

-- Create video_usage table for monthly limits
CREATE TABLE public.video_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL,
  month_year text NOT NULL,
  videos_generated integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(restaurant_id, month_year)
);

-- Enable RLS
ALTER TABLE public.video_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.video_usage ENABLE ROW LEVEL SECURITY;

-- RLS policies for video_jobs
CREATE POLICY "video_jobs_tenant_select" ON public.video_jobs
FOR SELECT USING (is_member_or_admin(restaurant_id));

CREATE POLICY "video_jobs_tenant_insert" ON public.video_jobs
FOR INSERT WITH CHECK (is_member_or_admin(restaurant_id));

CREATE POLICY "video_jobs_tenant_update" ON public.video_jobs
FOR UPDATE USING (is_member_or_admin(restaurant_id));

CREATE POLICY "video_jobs_tenant_delete" ON public.video_jobs
FOR DELETE USING (is_member_or_admin(restaurant_id));

-- RLS policies for video_usage
CREATE POLICY "video_usage_tenant_select" ON public.video_usage
FOR SELECT USING (is_member_or_admin(restaurant_id));

CREATE POLICY "video_usage_tenant_insert" ON public.video_usage
FOR INSERT WITH CHECK (is_member_or_admin(restaurant_id));

CREATE POLICY "video_usage_tenant_update" ON public.video_usage
FOR UPDATE USING (is_member_or_admin(restaurant_id));

-- Storage bucket for marketing videos
INSERT INTO storage.buckets (id, name, public)
VALUES ('marketing-videos', 'marketing-videos', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "marketing_videos_public_read" ON storage.objects
FOR SELECT USING (bucket_id = 'marketing-videos');

CREATE POLICY "marketing_videos_auth_upload" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'marketing-videos' AND auth.uid() IS NOT NULL);

CREATE POLICY "marketing_videos_auth_update" ON storage.objects
FOR UPDATE USING (bucket_id = 'marketing-videos' AND auth.uid() IS NOT NULL);

CREATE POLICY "marketing_videos_auth_delete" ON storage.objects
FOR DELETE USING (bucket_id = 'marketing-videos' AND auth.uid() IS NOT NULL);
