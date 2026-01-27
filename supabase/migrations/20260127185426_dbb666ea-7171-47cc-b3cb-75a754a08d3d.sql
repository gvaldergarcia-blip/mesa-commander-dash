-- Criar bucket para imagens de promoções
INSERT INTO storage.buckets (id, name, public)
VALUES ('promotion-images', 'promotion-images', true)
ON CONFLICT (id) DO NOTHING;

-- Política para acesso público de leitura
CREATE POLICY "Promotion images are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'promotion-images');

-- Política para upload por usuários autenticados
CREATE POLICY "Authenticated users can upload promotion images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'promotion-images' AND auth.role() = 'authenticated');

-- Política para delete por usuários autenticados
CREATE POLICY "Authenticated users can delete their promotion images"
ON storage.objects FOR DELETE
USING (bucket_id = 'promotion-images' AND auth.role() = 'authenticated');