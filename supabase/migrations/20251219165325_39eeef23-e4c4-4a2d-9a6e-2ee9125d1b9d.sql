-- Adicionar campo de tolerância à tabela queue_settings
ALTER TABLE public.queue_settings 
ADD COLUMN IF NOT EXISTS tolerance_minutes integer NOT NULL DEFAULT 10;

-- Comentário para documentação
COMMENT ON COLUMN public.queue_settings.tolerance_minutes IS 'Tempo de tolerância em minutos após ser chamado antes de considerar no-show';