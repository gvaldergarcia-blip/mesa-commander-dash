-- Criar tabela de configuração do programa 10 Cliks por restaurante
CREATE TABLE mesaclik.cliks_program (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES mesaclik.restaurants(id) ON DELETE CASCADE,
  is_active BOOLEAN NOT NULL DEFAULT false,
  reward_description TEXT NOT NULL,
  validity DATE,
  rules TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(restaurant_id)
);

-- Criar tabela de pontos dos usuários
CREATE TABLE mesaclik.cliks_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  restaurant_id UUID NOT NULL REFERENCES mesaclik.restaurants(id) ON DELETE CASCADE,
  total_cliks INTEGER NOT NULL DEFAULT 0,
  has_reward BOOLEAN NOT NULL DEFAULT false,
  last_updated TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, restaurant_id)
);

-- Habilitar RLS
ALTER TABLE mesaclik.cliks_program ENABLE ROW LEVEL SECURITY;
ALTER TABLE mesaclik.cliks_users ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para cliks_program
CREATE POLICY "Program readable by everyone"
  ON mesaclik.cliks_program FOR SELECT
  USING (true);

CREATE POLICY "Program writable by restaurant owner"
  ON mesaclik.cliks_program FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM mesaclik.restaurants r
      WHERE r.id = restaurant_id AND r.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM mesaclik.restaurants r
      WHERE r.id = restaurant_id AND r.owner_id = auth.uid()
    )
  );

-- Políticas RLS para cliks_users
CREATE POLICY "Cliks readable by user and restaurant owner"
  ON mesaclik.cliks_users FOR SELECT
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM mesaclik.restaurants r
      WHERE r.id = restaurant_id AND r.owner_id = auth.uid()
    )
  );

CREATE POLICY "Cliks writable by system"
  ON mesaclik.cliks_users FOR ALL
  USING (true)
  WITH CHECK (true);

-- Função para incrementar Cliks
CREATE OR REPLACE FUNCTION mesaclik.increment_cliks(
  p_user_id UUID,
  p_restaurant_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = mesaclik, public
AS $$
DECLARE
  v_current_cliks INTEGER;
  v_program_active BOOLEAN;
BEGIN
  -- Verificar se o programa está ativo
  SELECT is_active INTO v_program_active
  FROM mesaclik.cliks_program
  WHERE restaurant_id = p_restaurant_id;

  -- Se não está ativo, não fazer nada
  IF v_program_active IS NULL OR v_program_active = false THEN
    RETURN;
  END IF;

  -- Inserir ou atualizar pontos do usuário
  INSERT INTO mesaclik.cliks_users (user_id, restaurant_id, total_cliks, last_updated)
  VALUES (p_user_id, p_restaurant_id, 1, now())
  ON CONFLICT (user_id, restaurant_id)
  DO UPDATE SET
    total_cliks = CASE
      WHEN cliks_users.has_reward = true THEN 1  -- Reinicia se já resgatou
      ELSE cliks_users.total_cliks + 1
    END,
    has_reward = CASE
      WHEN cliks_users.has_reward = true THEN false  -- Reseta flag de recompensa
      WHEN cliks_users.total_cliks + 1 >= 10 THEN true  -- Marca se atingiu 10
      ELSE false
    END,
    last_updated = now()
  RETURNING total_cliks INTO v_current_cliks;

  -- Se atingiu 10 Cliks, notificar (será feito via edge function)
END;
$$;

-- Trigger para incrementar Cliks em reservas confirmadas
CREATE OR REPLACE FUNCTION mesaclik.handle_reservation_cliks()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = mesaclik, public
AS $$
BEGIN
  -- Incrementa apenas quando status muda para 'seated' (cliente foi atendido)
  IF NEW.status = 'seated' AND (OLD.status IS NULL OR OLD.status != 'seated') THEN
    PERFORM mesaclik.increment_cliks(NEW.user_id, NEW.restaurant_id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER reservation_cliks_trigger
  AFTER INSERT OR UPDATE ON mesaclik.reservations
  FOR EACH ROW
  EXECUTE FUNCTION mesaclik.handle_reservation_cliks();

-- Trigger para incrementar Cliks em entradas na fila
CREATE OR REPLACE FUNCTION mesaclik.handle_queue_cliks()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = mesaclik, public
AS $$
BEGIN
  -- Incrementa apenas quando status muda para 'seated' (cliente foi atendido)
  IF NEW.status = 'seated' AND (OLD.status IS NULL OR OLD.status != 'seated') THEN
    PERFORM mesaclik.increment_cliks(NEW.user_id, NEW.queue_id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER queue_cliks_trigger
  AFTER INSERT OR UPDATE ON mesaclik.queue_entries
  FOR EACH ROW
  EXECUTE FUNCTION mesaclik.handle_queue_cliks();

-- Habilitar Realtime
ALTER TABLE mesaclik.cliks_program REPLICA IDENTITY FULL;
ALTER TABLE mesaclik.cliks_users REPLICA IDENTITY FULL;

ALTER PUBLICATION supabase_realtime ADD TABLE mesaclik.cliks_program;
ALTER PUBLICATION supabase_realtime ADD TABLE mesaclik.cliks_users;

-- Índices para performance
CREATE INDEX idx_cliks_program_restaurant ON mesaclik.cliks_program(restaurant_id);
CREATE INDEX idx_cliks_users_user_restaurant ON mesaclik.cliks_users(user_id, restaurant_id);
CREATE INDEX idx_cliks_users_restaurant ON mesaclik.cliks_users(restaurant_id);
CREATE INDEX idx_cliks_users_reward ON mesaclik.cliks_users(restaurant_id, has_reward) WHERE has_reward = true;

-- Trigger para updated_at
CREATE TRIGGER update_cliks_program_updated_at
  BEFORE UPDATE ON mesaclik.cliks_program
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();