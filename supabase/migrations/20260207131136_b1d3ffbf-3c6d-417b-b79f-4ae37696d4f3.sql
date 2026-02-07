-- Adicionar policy de leitura pública para queues (necessário para o painel anon)
-- O painel precisa listar filas sem estar autenticado (modo dev)

CREATE POLICY "queues_public_read"
ON public.queues
FOR SELECT
TO anon, authenticated
USING (true);

-- Adicionar policy de leitura pública para queue_settings (necessário para o painel)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'queue_settings' AND policyname = 'queue_settings_public_read'
  ) THEN
    CREATE POLICY "queue_settings_public_read"
    ON public.queue_settings
    FOR SELECT
    TO anon, authenticated
    USING (true);
  END IF;
END $$;