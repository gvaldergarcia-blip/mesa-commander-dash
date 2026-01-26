-- Corrigir RLS para permitir que donos de restaurante adicionem clientes à fila manualmente
-- O problema é que o hook usa user_id = '00000000-0000-0000-0000-000000000000' para clientes manuais

-- Dropar políticas conflitantes no mesaclik.queue_entries
DROP POLICY IF EXISTS "qe_insert_owner" ON mesaclik.queue_entries;
DROP POLICY IF EXISTS "queue_entries_insert_own" ON mesaclik.queue_entries;
DROP POLICY IF EXISTS "queue_entries_insert_self" ON mesaclik.queue_entries;
DROP POLICY IF EXISTS "Users can insert queue entries" ON mesaclik.queue_entries;
DROP POLICY IF EXISTS "Users can insert their own queue entries" ON mesaclik.queue_entries;
DROP POLICY IF EXISTS "queue_entries_insert" ON mesaclik.queue_entries;

-- Criar política única e correta para INSERT
-- Permite: admin OU dono do restaurante OU usuário inserindo para si mesmo
CREATE POLICY "queue_entries_insert_unified" ON mesaclik.queue_entries
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM mesaclik.queues q
      JOIN mesaclik.restaurants r ON q.restaurant_id = r.id
      WHERE q.id = queue_id AND r.owner_id = auth.uid()
    )
    OR user_id = auth.uid()
  );