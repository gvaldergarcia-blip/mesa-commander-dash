ALTER PUBLICATION supabase_realtime ADD TABLE public.label_issuances;
ALTER TABLE public.label_issuances REPLICA IDENTITY FULL;