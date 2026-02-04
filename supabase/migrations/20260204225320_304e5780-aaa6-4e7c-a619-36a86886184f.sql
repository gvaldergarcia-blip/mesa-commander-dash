-- Tabela para jobs de geração de vídeo
CREATE TABLE public.video_jobs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'rendering', 'done', 'failed')),
  template TEXT NOT NULL CHECK (template IN ('A', 'B', 'C')),
  duration INTEGER NOT NULL CHECK (duration IN (7, 15, 30)),
  restaurant_name TEXT NOT NULL,
  location TEXT,
  promo_text TEXT,
  cta_type TEXT,
  cta_custom TEXT,
  image_urls TEXT[] NOT NULL,
  logo_url TEXT,
  video_url TEXT,
  thumbnail_url TEXT,
  music_url TEXT,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Índices para performance
CREATE INDEX idx_video_jobs_restaurant_id ON public.video_jobs(restaurant_id);
CREATE INDEX idx_video_jobs_status ON public.video_jobs(status);
CREATE INDEX idx_video_jobs_created_at ON public.video_jobs(created_at DESC);

-- Enable RLS
ALTER TABLE public.video_jobs ENABLE ROW LEVEL SECURITY;

-- Policies: usuários só acessam vídeos do seu restaurante
CREATE POLICY "Usuários podem ver vídeos do seu restaurante"
ON public.video_jobs
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.restaurant_members rm
    WHERE rm.restaurant_id = video_jobs.restaurant_id
    AND rm.user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.restaurants r
    WHERE r.id = video_jobs.restaurant_id
    AND r.owner_id = auth.uid()
  )
);

CREATE POLICY "Usuários podem criar vídeos para seu restaurante"
ON public.video_jobs
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.restaurant_members rm
    WHERE rm.restaurant_id = video_jobs.restaurant_id
    AND rm.user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.restaurants r
    WHERE r.id = video_jobs.restaurant_id
    AND r.owner_id = auth.uid()
  )
);

CREATE POLICY "Usuários podem atualizar vídeos do seu restaurante"
ON public.video_jobs
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.restaurant_members rm
    WHERE rm.restaurant_id = video_jobs.restaurant_id
    AND rm.user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.restaurants r
    WHERE r.id = video_jobs.restaurant_id
    AND r.owner_id = auth.uid()
  )
);

CREATE POLICY "Usuários podem deletar vídeos do seu restaurante"
ON public.video_jobs
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.restaurant_members rm
    WHERE rm.restaurant_id = video_jobs.restaurant_id
    AND rm.user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.restaurants r
    WHERE r.id = video_jobs.restaurant_id
    AND r.owner_id = auth.uid()
  )
);

-- Trigger para updated_at
CREATE TRIGGER update_video_jobs_updated_at
BEFORE UPDATE ON public.video_jobs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Tabela para controle de limite mensal de vídeos
CREATE TABLE public.video_usage (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  month_year TEXT NOT NULL, -- formato: 'YYYY-MM'
  videos_generated INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(restaurant_id, month_year)
);

-- Enable RLS
ALTER TABLE public.video_usage ENABLE ROW LEVEL SECURITY;

-- Policies para video_usage
CREATE POLICY "Usuários podem ver uso do seu restaurante"
ON public.video_usage
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.restaurant_members rm
    WHERE rm.restaurant_id = video_usage.restaurant_id
    AND rm.user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.restaurants r
    WHERE r.id = video_usage.restaurant_id
    AND r.owner_id = auth.uid()
  )
);

CREATE POLICY "Sistema pode gerenciar uso de vídeos"
ON public.video_usage
FOR ALL
USING (true)
WITH CHECK (true);

-- Criar bucket para vídeos gerados
INSERT INTO storage.buckets (id, name, public) 
VALUES ('videos', 'videos', true)
ON CONFLICT (id) DO NOTHING;

-- Policies para o bucket de vídeos
CREATE POLICY "Vídeos são públicos para visualização"
ON storage.objects FOR SELECT
USING (bucket_id = 'videos');

CREATE POLICY "Usuários autenticados podem fazer upload de vídeos"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'videos' AND auth.role() = 'authenticated');

CREATE POLICY "Usuários podem deletar seus vídeos"
ON storage.objects FOR DELETE
USING (bucket_id = 'videos' AND auth.role() = 'authenticated');