
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.kitchen_events;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
