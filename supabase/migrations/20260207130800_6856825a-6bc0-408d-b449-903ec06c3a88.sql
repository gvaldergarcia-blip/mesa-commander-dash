-- Seed/repair do restaurante de teste (Mocotó) para manter IDs alinhados entre schemas
-- Objetivo: evitar painel vazio quando o frontend consulta mesaclik.restaurants com RESTAURANT_ID fixo.

DO $$
BEGIN
  -- 1) Garantir restaurante no schema PUBLIC (necessário para FKs como video_jobs)
  INSERT INTO public.restaurants (id, name, cuisine, owner_id, address_line, city, about, has_queue, has_reservation, updated_at)
  VALUES (
    '8e5d4e30-3432-410a-bcd2-35a4fb5b8e9f',
    'Mocotó',
    'Outros'::public.cuisine_enum,
    'b01b96fb-bd8c-46d6-b168-b4d11ffdd208',
    'Av. Nossa Sra. do Loreto, 1100 - Vila Medeiros',
    'São Paulo',
    NULL,
    true,
    true,
    now()
  )
  ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    cuisine = EXCLUDED.cuisine,
    owner_id = COALESCE(public.restaurants.owner_id, EXCLUDED.owner_id),
    address_line = COALESCE(public.restaurants.address_line, EXCLUDED.address_line),
    city = COALESCE(public.restaurants.city, EXCLUDED.city),
    has_queue = COALESCE(public.restaurants.has_queue, EXCLUDED.has_queue),
    has_reservation = COALESCE(public.restaurants.has_reservation, EXCLUDED.has_reservation),
    updated_at = now();

  -- 2) Garantir restaurante no schema MESACLIK (onde o painel lê hoje)
  INSERT INTO mesaclik.restaurants (
    id,
    owner_id,
    name,
    cuisine,
    address_line,
    city,
    about,
    created_at,
    updated_at,
    has_queue,
    has_reservation,
    is_featured_novidades,
    is_featured_queue,
    is_featured_reservation,
    is_featured_both,
    home_priority,
    is_active,
    logo_url,
    menu_url,
    menu_image_url
  )
  VALUES (
    '8e5d4e30-3432-410a-bcd2-35a4fb5b8e9f',
    'b01b96fb-bd8c-46d6-b168-b4d11ffdd208',
    'Mocotó',
    'Outros',
    'Av. Nossa Sra. do Loreto, 1100 - Vila Medeiros',
    'São Paulo',
    NULL,
    now(),
    now(),
    true,
    true,
    false,
    false,
    false,
    false,
    0,
    true,
    NULL,
    NULL,
    NULL
  )
  ON CONFLICT (id) DO UPDATE SET
    owner_id = EXCLUDED.owner_id,
    name = EXCLUDED.name,
    cuisine = EXCLUDED.cuisine,
    address_line = COALESCE(mesaclik.restaurants.address_line, EXCLUDED.address_line),
    city = COALESCE(mesaclik.restaurants.city, EXCLUDED.city),
    has_queue = true,
    has_reservation = true,
    is_active = true,
    updated_at = now();

  -- 3) Garantir vínculo do owner (para RLS em tabelas auxiliares)
  INSERT INTO public.restaurant_members (restaurant_id, user_id, role)
  VALUES (
    '8e5d4e30-3432-410a-bcd2-35a4fb5b8e9f',
    'b01b96fb-bd8c-46d6-b168-b4d11ffdd208',
    'owner'
  )
  ON CONFLICT (restaurant_id, user_id) DO UPDATE SET role = 'owner';

  -- 4) Garantir existência de uma fila ativa no PUBLIC (fonte atual para queue_id)
  INSERT INTO public.queues (restaurant_id, name, is_active)
  SELECT '8e5d4e30-3432-410a-bcd2-35a4fb5b8e9f', 'Fila Principal', true
  WHERE NOT EXISTS (
    SELECT 1 FROM public.queues q
    WHERE q.restaurant_id = '8e5d4e30-3432-410a-bcd2-35a4fb5b8e9f'
  );
END $$;

-- 5) Função de autocorreção (DEV): recria o restaurante se sumir
CREATE OR REPLACE FUNCTION public.ensure_dev_test_restaurant()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, mesaclik
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_owner uuid := COALESCE(v_uid, 'b01b96fb-bd8c-46d6-b168-b4d11ffdd208');
BEGIN
  -- Se autenticado, restringe a admins (evita abuso). Se não autenticado, apenas INSERT (idempotente).
  IF v_uid IS NOT NULL AND NOT public.is_admin(v_uid) THEN
    RAISE EXCEPTION 'not allowed';
  END IF;

  -- PUBLIC: insere se não existir; se existir, só atualiza quando autenticado (admin)
  IF v_uid IS NULL THEN
    INSERT INTO public.restaurants (id, name, cuisine, owner_id, address_line, city, has_queue, has_reservation, updated_at)
    VALUES (
      '8e5d4e30-3432-410a-bcd2-35a4fb5b8e9f',
      'Mocotó',
      'Outros'::public.cuisine_enum,
      v_owner,
      'Av. Nossa Sra. do Loreto, 1100 - Vila Medeiros',
      'São Paulo',
      true,
      true,
      now()
    )
    ON CONFLICT (id) DO NOTHING;
  ELSE
    INSERT INTO public.restaurants (id, name, cuisine, owner_id, address_line, city, has_queue, has_reservation, updated_at)
    VALUES (
      '8e5d4e30-3432-410a-bcd2-35a4fb5b8e9f',
      'Mocotó',
      'Outros'::public.cuisine_enum,
      v_owner,
      'Av. Nossa Sra. do Loreto, 1100 - Vila Medeiros',
      'São Paulo',
      true,
      true,
      now()
    )
    ON CONFLICT (id) DO UPDATE SET
      owner_id = COALESCE(public.restaurants.owner_id, EXCLUDED.owner_id),
      name = EXCLUDED.name,
      cuisine = EXCLUDED.cuisine,
      updated_at = now();
  END IF;

  -- MESACLIK: insere se não existir; se existir, só atualiza quando autenticado (admin)
  IF v_uid IS NULL THEN
    INSERT INTO mesaclik.restaurants (
      id, owner_id, name, cuisine, address_line, city, created_at, updated_at,
      has_queue, has_reservation, is_featured_novidades, is_featured_queue, is_featured_reservation, is_featured_both,
      home_priority, is_active
    )
    VALUES (
      '8e5d4e30-3432-410a-bcd2-35a4fb5b8e9f',
      v_owner,
      'Mocotó',
      'Outros',
      'Av. Nossa Sra. do Loreto, 1100 - Vila Medeiros',
      'São Paulo',
      now(),
      now(),
      true,
      true,
      false,
      false,
      false,
      false,
      0,
      true
    )
    ON CONFLICT (id) DO NOTHING;
  ELSE
    INSERT INTO mesaclik.restaurants (
      id, owner_id, name, cuisine, address_line, city, created_at, updated_at,
      has_queue, has_reservation, is_featured_novidades, is_featured_queue, is_featured_reservation, is_featured_both,
      home_priority, is_active
    )
    VALUES (
      '8e5d4e30-3432-410a-bcd2-35a4fb5b8e9f',
      v_owner,
      'Mocotó',
      'Outros',
      'Av. Nossa Sra. do Loreto, 1100 - Vila Medeiros',
      'São Paulo',
      now(),
      now(),
      true,
      true,
      false,
      false,
      false,
      false,
      0,
      true
    )
    ON CONFLICT (id) DO UPDATE SET
      owner_id = EXCLUDED.owner_id,
      name = EXCLUDED.name,
      cuisine = EXCLUDED.cuisine,
      has_queue = true,
      has_reservation = true,
      is_active = true,
      updated_at = now();
  END IF;

  -- vínculo do owner (somente autenticado)
  IF v_uid IS NOT NULL THEN
    INSERT INTO public.restaurant_members (restaurant_id, user_id, role)
    VALUES ('8e5d4e30-3432-410a-bcd2-35a4fb5b8e9f', v_uid, 'owner')
    ON CONFLICT (restaurant_id, user_id) DO UPDATE SET role = 'owner';
  END IF;

  -- fila padrão (idempotente)
  INSERT INTO public.queues (restaurant_id, name, is_active)
  SELECT '8e5d4e30-3432-410a-bcd2-35a4fb5b8e9f', 'Fila Principal', true
  WHERE NOT EXISTS (
    SELECT 1 FROM public.queues q
    WHERE q.restaurant_id = '8e5d4e30-3432-410a-bcd2-35a4fb5b8e9f'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_dev_test_restaurant() TO anon, authenticated;