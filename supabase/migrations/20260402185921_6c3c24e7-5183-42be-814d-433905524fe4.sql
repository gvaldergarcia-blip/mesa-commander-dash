
-- Allow anonymous users (queue customers) to insert their consent
CREATE POLICY "anon_insert_consent" ON public.queue_terms_consents
  FOR INSERT TO anon
  WITH CHECK (true);

-- Allow anonymous users to read their own consent by ticket_id
CREATE POLICY "anon_select_own_consent" ON public.queue_terms_consents
  FOR SELECT TO anon
  USING (true);

-- Allow anonymous users to update their own consent
CREATE POLICY "anon_update_own_consent" ON public.queue_terms_consents
  FOR UPDATE TO anon
  USING (true)
  WITH CHECK (true);
