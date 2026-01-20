-- ============================================================
-- FILA WEB COM OTP - PARTE 1
-- Tabelas, RLS e Funções para autenticação via e-mail OTP
-- ============================================================

-- 1) TABELA: fila_entradas (entradas da fila vinculadas ao usuário autenticado)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.fila_entradas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurante_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  status text NOT NULL DEFAULT 'aguardando' CHECK (status IN ('aguardando', 'chamado', 'finalizado', 'cancelado')),
  party_size integer NOT NULL DEFAULT 1 CHECK (party_size >= 1 AND party_size <= 20),
  created_at timestamptz NOT NULL DEFAULT now(),
  called_at timestamptz,
  finalized_at timestamptz,
  canceled_at timestamptz,
  active boolean NOT NULL DEFAULT true
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_fila_entradas_restaurante_created 
  ON public.fila_entradas(restaurante_id, created_at);
CREATE INDEX IF NOT EXISTS idx_fila_entradas_user 
  ON public.fila_entradas(user_id);
CREATE INDEX IF NOT EXISTS idx_fila_entradas_restaurante_status 
  ON public.fila_entradas(restaurante_id, status);
CREATE INDEX IF NOT EXISTS idx_fila_entradas_active 
  ON public.fila_entradas(restaurante_id, active) WHERE active = true;

-- 2) TABELA: clientes_restaurante (relacionamento cliente-restaurante)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.clientes_restaurante (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurante_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  visitas_concluidas integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(restaurante_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_clientes_restaurante_user 
  ON public.clientes_restaurante(user_id);

-- 3) TABELA: consentimentos_cliente (LGPD - preferências de marketing)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.consentimentos_cliente (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurante_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  aceitou_ofertas_email boolean NOT NULL DEFAULT false,
  aceitou_termos_uso boolean NOT NULL DEFAULT false,
  aceitou_politica_privacidade boolean NOT NULL DEFAULT false,
  data_consentimento timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(restaurante_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_consentimentos_user 
  ON public.consentimentos_cliente(user_id);

-- ============================================================
-- 4) RLS POLICIES
-- ============================================================

-- Habilitar RLS
ALTER TABLE public.fila_entradas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clientes_restaurante ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consentimentos_cliente ENABLE ROW LEVEL SECURITY;

-- Políticas para fila_entradas
CREATE POLICY "Usuarios podem ver suas proprias entradas"
  ON public.fila_entradas FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Usuarios podem criar suas proprias entradas"
  ON public.fila_entradas FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuarios podem atualizar suas proprias entradas"
  ON public.fila_entradas FOR UPDATE
  USING (auth.uid() = user_id);

-- Políticas para clientes_restaurante
CREATE POLICY "Usuarios podem ver seus proprios registros"
  ON public.clientes_restaurante FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Usuarios podem criar seus proprios registros"
  ON public.clientes_restaurante FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuarios podem atualizar seus proprios registros"
  ON public.clientes_restaurante FOR UPDATE
  USING (auth.uid() = user_id);

-- Políticas para consentimentos_cliente
CREATE POLICY "Usuarios podem ver seus consentimentos"
  ON public.consentimentos_cliente FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Usuarios podem criar seus consentimentos"
  ON public.consentimentos_cliente FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuarios podem atualizar seus consentimentos"
  ON public.consentimentos_cliente FOR UPDATE
  USING (auth.uid() = user_id);

-- ============================================================
-- 5) FUNÇÃO: create_queue_entry_web
-- Cria entrada na fila de forma transacional
-- ============================================================
CREATE OR REPLACE FUNCTION public.create_queue_entry_web(
  p_restaurante_id uuid,
  p_party_size integer DEFAULT 1
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_email text;
  v_entry_id uuid;
  v_existing_entry_id uuid;
  v_restaurant_active boolean;
BEGIN
  -- Obter usuário autenticado
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Usuário não autenticado');
  END IF;

  -- Obter e-mail do usuário
  SELECT email INTO v_email FROM auth.users WHERE id = v_user_id;
  IF v_email IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'E-mail do usuário não encontrado');
  END IF;

  -- Validar restaurante existe e está ativo
  SELECT has_queue INTO v_restaurant_active 
  FROM public.restaurants 
  WHERE id = p_restaurante_id;
  
  IF v_restaurant_active IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Restaurante não encontrado');
  END IF;

  -- Verificar se já tem entrada ativa
  SELECT id INTO v_existing_entry_id
  FROM public.fila_entradas
  WHERE restaurante_id = p_restaurante_id
    AND user_id = v_user_id
    AND status IN ('aguardando', 'chamado')
    AND active = true
  LIMIT 1;

  IF v_existing_entry_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', true, 
      'entry_id', v_existing_entry_id,
      'already_exists', true,
      'message', 'Você já está na fila'
    );
  END IF;

  -- Criar entrada na fila
  INSERT INTO public.fila_entradas (restaurante_id, user_id, email, party_size, status, active)
  VALUES (p_restaurante_id, v_user_id, v_email, p_party_size, 'aguardando', true)
  RETURNING id INTO v_entry_id;

  -- Upsert em clientes_restaurante
  INSERT INTO public.clientes_restaurante (restaurante_id, user_id, email)
  VALUES (p_restaurante_id, v_user_id, v_email)
  ON CONFLICT (restaurante_id, user_id) 
  DO UPDATE SET updated_at = now();

  -- Upsert em consentimentos_cliente (com defaults)
  INSERT INTO public.consentimentos_cliente (restaurante_id, user_id, email)
  VALUES (p_restaurante_id, v_user_id, v_email)
  ON CONFLICT (restaurante_id, user_id) 
  DO NOTHING;

  RETURN jsonb_build_object(
    'success', true, 
    'entry_id', v_entry_id,
    'already_exists', false,
    'message', 'Entrada criada com sucesso'
  );
END;
$$;

-- ============================================================
-- 6) FUNÇÃO: get_my_queue_status
-- Retorna status e posição do usuário na fila
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_my_queue_status(p_restaurante_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_entry record;
  v_position integer;
  v_total_ahead integer;
  v_consent record;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Usuário não autenticado');
  END IF;

  -- Buscar entrada ativa do usuário
  SELECT id, status, created_at, party_size, called_at, finalized_at
  INTO v_entry
  FROM public.fila_entradas
  WHERE restaurante_id = p_restaurante_id
    AND user_id = v_user_id
    AND active = true
    AND status IN ('aguardando', 'chamado')
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_entry IS NULL THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'Nenhuma entrada ativa encontrada',
      'in_queue', false
    );
  END IF;

  -- Calcular posição (quantos estão na frente + 1)
  SELECT COUNT(*) + 1 INTO v_position
  FROM public.fila_entradas
  WHERE restaurante_id = p_restaurante_id
    AND status IN ('aguardando', 'chamado')
    AND active = true
    AND (created_at < v_entry.created_at 
         OR (created_at = v_entry.created_at AND id < v_entry.id));

  -- Buscar consentimentos
  SELECT aceitou_ofertas_email, aceitou_termos_uso, aceitou_politica_privacidade
  INTO v_consent
  FROM public.consentimentos_cliente
  WHERE restaurante_id = p_restaurante_id AND user_id = v_user_id;

  RETURN jsonb_build_object(
    'success', true,
    'in_queue', true,
    'entry_id', v_entry.id,
    'status', v_entry.status,
    'position', v_position,
    'party_size', v_entry.party_size,
    'created_at', v_entry.created_at,
    'called_at', v_entry.called_at,
    'consent', jsonb_build_object(
      'aceitou_ofertas_email', COALESCE(v_consent.aceitou_ofertas_email, false),
      'aceitou_termos_uso', COALESCE(v_consent.aceitou_termos_uso, false),
      'aceitou_politica_privacidade', COALESCE(v_consent.aceitou_politica_privacidade, false)
    )
  );
END;
$$;

-- ============================================================
-- 7) FUNÇÃO: update_consent
-- Atualiza consentimentos do usuário
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_consent(
  p_restaurante_id uuid,
  p_aceitou_ofertas_email boolean DEFAULT NULL,
  p_aceitou_termos_uso boolean DEFAULT NULL,
  p_aceitou_politica_privacidade boolean DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Usuário não autenticado');
  END IF;

  UPDATE public.consentimentos_cliente
  SET 
    aceitou_ofertas_email = COALESCE(p_aceitou_ofertas_email, aceitou_ofertas_email),
    aceitou_termos_uso = COALESCE(p_aceitou_termos_uso, aceitou_termos_uso),
    aceitou_politica_privacidade = COALESCE(p_aceitou_politica_privacidade, aceitou_politica_privacidade),
    data_consentimento = CASE 
      WHEN p_aceitou_ofertas_email IS NOT NULL 
        OR p_aceitou_termos_uso IS NOT NULL 
        OR p_aceitou_politica_privacidade IS NOT NULL 
      THEN now() 
      ELSE data_consentimento 
    END,
    updated_at = now()
  WHERE restaurante_id = p_restaurante_id AND user_id = v_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Registro de consentimento não encontrado');
  END IF;

  RETURN jsonb_build_object('success', true, 'message', 'Consentimento atualizado');
END;
$$;

-- ============================================================
-- 8) FUNÇÃO: cancel_my_queue_entry
-- Permite usuário cancelar sua própria entrada
-- ============================================================
CREATE OR REPLACE FUNCTION public.cancel_my_queue_entry(p_restaurante_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_entry_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Usuário não autenticado');
  END IF;

  UPDATE public.fila_entradas
  SET status = 'cancelado', 
      canceled_at = now(), 
      active = false
  WHERE restaurante_id = p_restaurante_id
    AND user_id = v_user_id
    AND status IN ('aguardando', 'chamado')
    AND active = true
  RETURNING id INTO v_entry_id;

  IF v_entry_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Nenhuma entrada ativa para cancelar');
  END IF;

  RETURN jsonb_build_object('success', true, 'entry_id', v_entry_id, 'message', 'Entrada cancelada');
END;
$$;

-- ============================================================
-- 9) Políticas adicionais para operadores (service_role)
-- O painel usa service_role, então não precisa de policies extras
-- Mas podemos adicionar para donos de restaurante verem suas filas
-- ============================================================

-- Donos de restaurante podem ver entradas da sua fila
CREATE POLICY "Donos podem ver entradas do seu restaurante"
  ON public.fila_entradas FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.restaurants 
      WHERE id = fila_entradas.restaurante_id 
      AND owner_id = auth.uid()
    )
  );

-- Donos podem atualizar entradas (chamar, finalizar)
CREATE POLICY "Donos podem atualizar entradas do seu restaurante"
  ON public.fila_entradas FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.restaurants 
      WHERE id = fila_entradas.restaurante_id 
      AND owner_id = auth.uid()
    )
  );

-- Donos podem ver clientes do seu restaurante
CREATE POLICY "Donos podem ver clientes do seu restaurante"
  ON public.clientes_restaurante FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.restaurants 
      WHERE id = clientes_restaurante.restaurante_id 
      AND owner_id = auth.uid()
    )
  );

-- Donos podem ver consentimentos do seu restaurante
CREATE POLICY "Donos podem ver consentimentos do seu restaurante"
  ON public.consentimentos_cliente FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.restaurants 
      WHERE id = consentimentos_cliente.restaurante_id 
      AND owner_id = auth.uid()
    )
  );