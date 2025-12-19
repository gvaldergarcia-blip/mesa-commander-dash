-- ===========================================
-- SQL PARA SINCRONIZAÇÃO AUTOMÁTICA COM APP
-- Configurações de Fila e Reservas
-- ===========================================

-- Habilitar REPLICA IDENTITY FULL para Realtime funcionar corretamente
ALTER TABLE public.queue_settings REPLICA IDENTITY FULL;
ALTER TABLE public.reservation_settings REPLICA IDENTITY FULL;

-- Adicionar tabelas ao Supabase Realtime Publication
DO $$
BEGIN
  -- Verificar se as tabelas já estão na publicação
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'queue_settings'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.queue_settings;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'reservation_settings'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.reservation_settings;
  END IF;
END $$;

-- ===========================================
-- DOCUMENTAÇÃO PARA O CURSOR
-- ===========================================
-- 
-- TABELA: public.queue_settings
-- Campos:
--   - restaurant_id (uuid): ID do restaurante
--   - max_party_size (integer): Tamanho máximo do grupo (default: 8)
--   - queue_capacity (integer): Capacidade máxima da fila (default: 50)
--   - avg_time_1_2 (integer): Tempo médio de espera para grupos de 1-2 pessoas (minutos)
--   - avg_time_3_4 (integer): Tempo médio de espera para grupos de 3-4 pessoas (minutos)
--   - avg_time_5_6 (integer): Tempo médio de espera para grupos de 5-6 pessoas (minutos)
--   - avg_time_7_8 (integer): Tempo médio de espera para grupos de 7-8 pessoas (minutos)
--
-- TABELA: public.reservation_settings
-- Campos:
--   - restaurant_id (uuid): ID do restaurante
--   - max_party_size (integer): Tamanho máximo do grupo para reservas (default: 8)
--   - tolerance_minutes (integer): Tolerância em minutos para chegada (default: 15)
--
-- ===========================================
-- CÓDIGO JAVASCRIPT PARA O CURSOR USAR:
-- ===========================================
--
-- // Escutar mudanças em queue_settings
-- const queueChannel = supabase
--   .channel('queue-settings-changes')
--   .on('postgres_changes', {
--     event: '*',
--     schema: 'public',
--     table: 'queue_settings',
--     filter: `restaurant_id=eq.${restaurantId}`
--   }, (payload) => {
--     console.log('Queue settings changed:', payload);
--     // payload.new contém os novos valores
--     // payload.old contém os valores antigos
--   })
--   .subscribe();
--
-- // Escutar mudanças em reservation_settings
-- const reservationChannel = supabase
--   .channel('reservation-settings-changes')
--   .on('postgres_changes', {
--     event: '*',
--     schema: 'public',
--     table: 'reservation_settings',
--     filter: `restaurant_id=eq.${restaurantId}`
--   }, (payload) => {
--     console.log('Reservation settings changed:', payload);
--   })
--   .subscribe();
--
-- ===========================================