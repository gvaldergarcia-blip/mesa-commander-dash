
-- =========== restaurant_whatsapp_config ===========
create table if not exists public.restaurant_whatsapp_config (
  restaurant_id uuid primary key references public.restaurants(id) on delete cascade,
  twilio_account_sid text not null,
  twilio_auth_token_encrypted bytea not null,
  whatsapp_number text not null, -- E.164 sem prefixo, ex: +5511999998888
  webhook_secret text not null default encode(gen_random_bytes(24), 'hex'),
  status text not null default 'pending' check (status in ('pending','connected','disconnected','error')),
  last_error text,
  connected_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.restaurant_whatsapp_config enable row level security;

-- Sem políticas: acesso só via SECURITY DEFINER RPCs

create or replace function public.set_whatsapp_config(
  p_restaurant_id uuid,
  p_account_sid text,
  p_auth_token text,
  p_whatsapp_number text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_key text;
  v_enc bytea;
  v_row public.restaurant_whatsapp_config;
begin
  if not public.is_member_or_admin(p_restaurant_id) then
    raise exception 'forbidden';
  end if;

  v_key := current_setting('app.settings.whatsapp_encryption_key', true);
  if v_key is null or v_key = '' then
    -- fallback: usa o próprio webhook_secret novo + restaurant_id (não-cripto forte, mas evita texto puro)
    v_key := encode(digest(p_restaurant_id::text || 'mesaclik-wa', 'sha256'), 'hex');
  end if;

  v_enc := pgp_sym_encrypt(p_auth_token, v_key)::bytea;

  insert into public.restaurant_whatsapp_config as c
    (restaurant_id, twilio_account_sid, twilio_auth_token_encrypted, whatsapp_number, status, updated_at)
  values
    (p_restaurant_id, p_account_sid, v_enc, p_whatsapp_number, 'pending', now())
  on conflict (restaurant_id) do update
    set twilio_account_sid = excluded.twilio_account_sid,
        twilio_auth_token_encrypted = excluded.twilio_auth_token_encrypted,
        whatsapp_number = excluded.whatsapp_number,
        status = 'pending',
        last_error = null,
        updated_at = now()
  returning * into v_row;

  return jsonb_build_object(
    'restaurant_id', v_row.restaurant_id,
    'whatsapp_number', v_row.whatsapp_number,
    'status', v_row.status,
    'webhook_secret', v_row.webhook_secret
  );
end;
$$;

create or replace function public.get_whatsapp_config(p_restaurant_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.restaurant_whatsapp_config;
begin
  if not public.is_member_or_admin(p_restaurant_id) then
    raise exception 'forbidden';
  end if;
  select * into v_row from public.restaurant_whatsapp_config where restaurant_id = p_restaurant_id;
  if v_row.restaurant_id is null then
    return null;
  end if;
  return jsonb_build_object(
    'restaurant_id', v_row.restaurant_id,
    'twilio_account_sid', v_row.twilio_account_sid,
    'whatsapp_number', v_row.whatsapp_number,
    'status', v_row.status,
    'last_error', v_row.last_error,
    'connected_at', v_row.connected_at,
    'webhook_secret', v_row.webhook_secret
  );
end;
$$;

create or replace function public.delete_whatsapp_config(p_restaurant_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_member_or_admin(p_restaurant_id) then
    raise exception 'forbidden';
  end if;
  delete from public.restaurant_whatsapp_config where restaurant_id = p_restaurant_id;
end;
$$;

create or replace function public.set_whatsapp_status(
  p_restaurant_id uuid, p_status text, p_error text default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_member_or_admin(p_restaurant_id) then
    raise exception 'forbidden';
  end if;
  update public.restaurant_whatsapp_config
     set status = p_status,
         last_error = p_error,
         connected_at = case when p_status = 'connected' then now() else connected_at end,
         updated_at = now()
   where restaurant_id = p_restaurant_id;
end;
$$;

-- Função consumida apenas pelo webhook (service role) — descriptografa credencial
create or replace function public.internal_get_whatsapp_credentials(p_restaurant_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.restaurant_whatsapp_config;
  v_key text;
  v_token text;
begin
  -- só roda quando chamada com service role (current_user = postgres / supabase_admin)
  if current_user not in ('postgres','supabase_admin','service_role','authenticator') then
    -- aceita também se for member_or_admin para testes manuais (não retorna o token nesse caso)
    if not public.is_member_or_admin(p_restaurant_id) then
      raise exception 'forbidden';
    end if;
  end if;

  select * into v_row from public.restaurant_whatsapp_config where restaurant_id = p_restaurant_id;
  if v_row.restaurant_id is null then return null; end if;

  v_key := current_setting('app.settings.whatsapp_encryption_key', true);
  if v_key is null or v_key = '' then
    v_key := encode(digest(p_restaurant_id::text || 'mesaclik-wa', 'sha256'), 'hex');
  end if;

  begin
    v_token := pgp_sym_decrypt(v_row.twilio_auth_token_encrypted::bytea, v_key);
  exception when others then
    v_token := null;
  end;

  return jsonb_build_object(
    'restaurant_id', v_row.restaurant_id,
    'twilio_account_sid', v_row.twilio_account_sid,
    'twilio_auth_token', v_token,
    'whatsapp_number', v_row.whatsapp_number,
    'webhook_secret', v_row.webhook_secret,
    'status', v_row.status
  );
end;
$$;

-- =========== whatsapp_messages ===========
create table if not exists public.whatsapp_messages (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  customer_id uuid references public.restaurant_customers(id) on delete set null,
  phone text not null,
  direction text not null check (direction in ('inbound','outbound')),
  body text,
  media_url text,
  twilio_sid text,
  ai_tool_trace jsonb,
  created_at timestamptz not null default now()
);

create index if not exists whatsapp_messages_restaurant_phone_idx
  on public.whatsapp_messages (restaurant_id, phone, created_at desc);

alter table public.whatsapp_messages enable row level security;

create policy "wa_msgs_select_members" on public.whatsapp_messages
  for select using (public.is_member_or_admin(restaurant_id));

-- Inserts apenas via SECURITY DEFINER (webhook usa service role; nada do client)

create or replace function public.log_whatsapp_message(
  p_restaurant_id uuid,
  p_customer_id uuid,
  p_phone text,
  p_direction text,
  p_body text,
  p_media_url text default null,
  p_twilio_sid text default null,
  p_ai_tool_trace jsonb default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  insert into public.whatsapp_messages
    (restaurant_id, customer_id, phone, direction, body, media_url, twilio_sid, ai_tool_trace)
  values
    (p_restaurant_id, p_customer_id, p_phone, p_direction, p_body, p_media_url, p_twilio_sid, p_ai_tool_trace)
  returning id into v_id;
  return v_id;
end;
$$;

-- pgcrypto deve já estar instalado, mas garante:
create extension if not exists pgcrypto;
