
-- Rascunho de "Recebimento por fotos" — sincroniza celular/computador
CREATE TABLE public.label_receipt_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL UNIQUE,
  supplier_id uuid NULL,
  reference text NULL,
  groups jsonb NOT NULL DEFAULT '[]'::jsonb,
  photos jsonb NOT NULL DEFAULT '[]'::jsonb,
  finalized_receipt_id uuid NULL,
  updated_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.label_receipt_drafts TO authenticated;
GRANT ALL ON public.label_receipt_drafts TO service_role;

ALTER TABLE public.label_receipt_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members read drafts"
  ON public.label_receipt_drafts FOR SELECT TO authenticated
  USING (public.is_member_or_admin(restaurant_id));
CREATE POLICY "members insert drafts"
  ON public.label_receipt_drafts FOR INSERT TO authenticated
  WITH CHECK (public.is_member_or_admin(restaurant_id));
CREATE POLICY "members update drafts"
  ON public.label_receipt_drafts FOR UPDATE TO authenticated
  USING (public.is_member_or_admin(restaurant_id))
  WITH CHECK (public.is_member_or_admin(restaurant_id));
CREATE POLICY "members delete drafts"
  ON public.label_receipt_drafts FOR DELETE TO authenticated
  USING (public.is_member_or_admin(restaurant_id));

CREATE TRIGGER trg_label_receipt_drafts_touch
  BEFORE UPDATE ON public.label_receipt_drafts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER PUBLICATION supabase_realtime ADD TABLE public.label_receipt_drafts;
ALTER TABLE public.label_receipt_drafts REPLICA IDENTITY FULL;

-- Policies do bucket de storage (bucket criado via tool)
CREATE POLICY "members read draft photos"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'label-receipt-drafts'
    AND public.is_member_or_admin((storage.foldername(name))[1]::uuid)
  );
CREATE POLICY "members upload draft photos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'label-receipt-drafts'
    AND public.is_member_or_admin((storage.foldername(name))[1]::uuid)
  );
CREATE POLICY "members delete draft photos"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'label-receipt-drafts'
    AND public.is_member_or_admin((storage.foldername(name))[1]::uuid)
  );
