-- Allow anon to read ai_palpites (for demo/dev dashboard like restaurant_customers)
CREATE POLICY ai_palpites_anon_read
  ON public.ai_palpites
  FOR SELECT
  TO anon
  USING (true);
