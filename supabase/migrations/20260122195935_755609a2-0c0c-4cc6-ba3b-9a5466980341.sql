-- Adicionar coluna 'source' para rastrear origem do envio de email (ex: 'palpite_ia', 'campaign', 'manual')
ALTER TABLE public.email_logs 
ADD COLUMN IF NOT EXISTS source text DEFAULT 'manual';

COMMENT ON COLUMN public.email_logs.source IS 'Origem do envio: palpite_ia, campaign, manual';