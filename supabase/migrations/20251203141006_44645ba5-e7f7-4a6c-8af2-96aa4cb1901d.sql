-- Conceder permissões ao service_role para o schema mesaclik
GRANT USAGE ON SCHEMA mesaclik TO service_role;
GRANT ALL ON ALL TABLES IN SCHEMA mesaclik TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA mesaclik TO service_role;

-- Garantir que futuras tabelas também tenham permissão
ALTER DEFAULT PRIVILEGES IN SCHEMA mesaclik GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA mesaclik GRANT ALL ON SEQUENCES TO service_role;