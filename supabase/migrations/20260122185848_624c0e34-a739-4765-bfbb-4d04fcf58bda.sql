-- Tabela para armazenar insights gerados pelo sistema
CREATE TABLE IF NOT EXISTS public.system_insights (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID NOT NULL,
  restaurant_id UUID NOT NULL,
  insight_type TEXT NOT NULL,
  message TEXT NOT NULL,
  action_allowed BOOLEAN NOT NULL DEFAULT false,
  dismissed BOOLEAN NOT NULL DEFAULT false,
  dismissed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_system_insights_customer ON public.system_insights(customer_id);
CREATE INDEX IF NOT EXISTS idx_system_insights_restaurant ON public.system_insights(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_system_insights_type ON public.system_insights(insight_type);
CREATE INDEX IF NOT EXISTS idx_system_insights_active ON public.system_insights(restaurant_id, dismissed) WHERE dismissed = false;

-- Enable RLS
ALTER TABLE public.system_insights ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para acesso anônimo (tela comando) e proprietário
CREATE POLICY "system_insights_anon_select" ON public.system_insights
  FOR SELECT USING (true);

CREATE POLICY "system_insights_anon_insert" ON public.system_insights
  FOR INSERT WITH CHECK (true);

CREATE POLICY "system_insights_anon_update" ON public.system_insights
  FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "system_insights_owner_all" ON public.system_insights
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM mesaclik.restaurants r
      WHERE r.id = system_insights.restaurant_id
      AND r.owner_id = auth.uid()
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM mesaclik.restaurants r
      WHERE r.id = system_insights.restaurant_id
      AND r.owner_id = auth.uid()
    )
  );

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION public.update_system_insights_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_system_insights_updated_at
  BEFORE UPDATE ON public.system_insights
  FOR EACH ROW
  EXECUTE FUNCTION public.update_system_insights_updated_at();

-- Comentários para documentação
COMMENT ON TABLE public.system_insights IS 'Armazena insights/palpites gerados pelo sistema para cada cliente';
COMMENT ON COLUMN public.system_insights.insight_type IS 'Tipo do insight: queue_dropout, reservation_canceled, inactive, recurrent, vip_missing';
COMMENT ON COLUMN public.system_insights.action_allowed IS 'True se cliente autorizou marketing (aceitou_ofertas_email)';