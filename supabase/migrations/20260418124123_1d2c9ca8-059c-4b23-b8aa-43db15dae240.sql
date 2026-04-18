
-- Add new fields requested by spec
ALTER TABLE public.checklist_categories
  ADD COLUMN IF NOT EXISTS icon TEXT NOT NULL DEFAULT 'ClipboardList';

ALTER TABLE public.checklist_items
  ADD COLUMN IF NOT EXISTS has_qr BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS scheduled_time TEXT;

-- Ensure storage bucket exists for checklist photos (private, authenticated access)
INSERT INTO storage.buckets (id, name, public)
VALUES ('checklist-photos', 'checklist-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: any authenticated member can read/upload to their restaurant's folder
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects'
      AND policyname='checklist_photos_select_auth'
  ) THEN
    CREATE POLICY "checklist_photos_select_auth"
      ON storage.objects FOR SELECT
      TO authenticated
      USING (bucket_id = 'checklist-photos');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects'
      AND policyname='checklist_photos_insert_auth'
  ) THEN
    CREATE POLICY "checklist_photos_insert_auth"
      ON storage.objects FOR INSERT
      TO authenticated
      WITH CHECK (bucket_id = 'checklist-photos');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects'
      AND policyname='checklist_photos_delete_auth'
  ) THEN
    CREATE POLICY "checklist_photos_delete_auth"
      ON storage.objects FOR DELETE
      TO authenticated
      USING (bucket_id = 'checklist-photos');
  END IF;
END $$;

-- Enable Realtime for live sync between Manager and Team
ALTER TABLE public.checklist_categories REPLICA IDENTITY FULL;
ALTER TABLE public.checklist_items REPLICA IDENTITY FULL;
ALTER TABLE public.checklist_completions REPLICA IDENTITY FULL;

DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.checklist_categories;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.checklist_items;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.checklist_completions;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;
