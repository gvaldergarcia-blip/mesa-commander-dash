-- Adicionar coluna logo_url na tabela mesaclik.restaurants
ALTER TABLE mesaclik.restaurants
ADD COLUMN logo_url TEXT;

-- Adicionar comentário para documentação
COMMENT ON COLUMN mesaclik.restaurants.logo_url IS 'URL da logo do restaurante (formato quadrado recomendado, ex: 512x512)';