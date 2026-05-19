
alter table public.restaurant_whatsapp_config
  alter column twilio_account_sid drop not null,
  alter column twilio_auth_token_encrypted drop not null;

alter table public.restaurant_whatsapp_config
  add column if not exists greeting_message text;

create or replace function public.set_whatsapp_link(
  p_restaurant_id uuid,
  p_whatsapp_number text,
  p_greeting_message text default null
) returns jsonb
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

  insert into public.restaurant_whatsapp_config as c
    (restaurant_id, whatsapp_number, greeting_message, status, updated_at)
  values
    (p_restaurant_id, p_whatsapp_number, p_greeting_message, 'connected', now())
  on conflict (restaurant_id) do update
    set whatsapp_number = excluded.whatsapp_number,
        greeting_message = excluded.greeting_message,
        status = 'connected',
        connected_at = coalesce(c.connected_at, now()),
        updated_at = now()
  returning * into v_row;

  return jsonb_build_object(
    'restaurant_id', v_row.restaurant_id,
    'whatsapp_number', v_row.whatsapp_number,
    'greeting_message', v_row.greeting_message,
    'status', v_row.status
  );
end;
$$;

create or replace function public.get_whatsapp_link(p_restaurant_id uuid)
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
    'whatsapp_number', v_row.whatsapp_number,
    'greeting_message', v_row.greeting_message,
    'status', v_row.status
  );
end;
$$;
