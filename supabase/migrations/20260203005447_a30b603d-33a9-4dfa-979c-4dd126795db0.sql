-- Fix permissions for queue status RPC used by the dashboard buttons (Chamar/Sentar/Cancelar)

-- Ensure roles can use the schema
GRANT USAGE ON SCHEMA mesaclik TO anon;
GRANT USAGE ON SCHEMA mesaclik TO authenticated;

-- Ensure roles can execute the RPC
GRANT EXECUTE ON FUNCTION mesaclik.update_queue_entry_status_v2(uuid, text) TO anon;
GRANT EXECUTE ON FUNCTION mesaclik.update_queue_entry_status_v2(uuid, text) TO authenticated;
