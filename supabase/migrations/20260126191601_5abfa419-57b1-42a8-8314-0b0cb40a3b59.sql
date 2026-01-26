-- O problema é que a política atual requer 'authenticated' mas o usuário pode não estar logado
-- OU a função is_admin não está retornando true corretamente

-- Vamos criar uma política mais permissiva para INSERT que permite:
-- 1. Qualquer admin
-- 2. Qualquer dono do restaurante 
-- 3. Qualquer membro do restaurante

-- Primeiro dropar a política existente
DROP POLICY IF EXISTS "queue_entries_insert_unified" ON mesaclik.queue_entries;

-- Criar política que permite INSERT para donos/admins COM verificação mais simples
-- Usando public.is_admin() e verificando owner_id diretamente
CREATE POLICY "queue_entries_insert_for_owners" ON mesaclik.queue_entries
  FOR INSERT TO authenticated
  WITH CHECK (
    -- Admin global
    public.is_admin()
    -- OU dono do restaurante (via queue -> restaurant)
    OR EXISTS (
      SELECT 1 
      FROM mesaclik.queues q
      INNER JOIN mesaclik.restaurants r ON r.id = q.restaurant_id
      WHERE q.id = queue_entries.queue_id 
        AND r.owner_id = auth.uid()
    )
    -- OU é o próprio usuário criando para si
    OR user_id = auth.uid()
  );

-- Também precisamos garantir que existe uma política para public (caso não logado)
-- que permita o dono adicionar via dashboard
-- Mas isso não é seguro - o usuário DEVE estar autenticado

-- Verificar se há política de SELECT para o dashboard funcionar
DROP POLICY IF EXISTS "queue_entries_select_for_owners" ON mesaclik.queue_entries;

CREATE POLICY "queue_entries_select_for_owners" ON mesaclik.queue_entries
  FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 
      FROM mesaclik.queues q
      INNER JOIN mesaclik.restaurants r ON r.id = q.restaurant_id
      WHERE q.id = queue_entries.queue_id 
        AND r.owner_id = auth.uid()
    )
    OR user_id = auth.uid()
  );