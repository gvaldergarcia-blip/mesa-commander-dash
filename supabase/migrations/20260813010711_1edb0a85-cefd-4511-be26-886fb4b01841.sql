
CREATE TABLE IF NOT EXISTS public.whatsapp_notification_settings (
  restaurant_id uuid PRIMARY KEY,
  enabled boolean NOT NULL DEFAULT false,
  connection_status text NOT NULL DEFAULT 'disconnected',
  last_checked_at timestamptz,
  last_error text,
  events jsonb NOT NULL DEFAULT '{
    "validity_today": false,
    "validity_tomorrow": false,
    "validity_soon": false,
    "stock_below_min": false,
    "stock_out": false,
    "stock_replenish": false,
    "receipt_pending": false,
    "receipt_awaiting_info": false,
    "receipt_divergence": false,
    "checklist_pending": false,
    "loss_registered": false,
    "transfer_done": false,
    "operational_event": false
  }'::jsonb,
  quiet_hours_start smallint NOT NULL DEFAULT 22,
  quiet_hours_end smallint NOT NULL DEFAULT 7,
  dedupe_window_hours integer NOT NULL DEFAULT 12,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_notification_settings TO authenticated;
GRANT ALL ON public.whatsapp_notification_settings TO service_role;
ALTER TABLE public.whatsapp_notification_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members manage whatsapp notification settings"
ON public.whatsapp_notification_settings FOR ALL TO authenticated
USING (public.is_member_or_admin(restaurant_id))
WITH CHECK (public.is_member_or_admin(restaurant_id));

CREATE TRIGGER trg_whatsapp_notification_settings_updated_at
BEFORE UPDATE ON public.whatsapp_notification_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.label_employees
  ADD COLUMN IF NOT EXISTS notifications_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notification_types text[] NOT NULL DEFAULT ARRAY[]::text[];

ALTER TABLE public.label_sms_logs
  ADD COLUMN IF NOT EXISTS channel text NOT NULL DEFAULT 'sms',
  ADD COLUMN IF NOT EXISTS event_type text,
  ADD COLUMN IF NOT EXISTS dedupe_key text,
  ADD COLUMN IF NOT EXISTS provider_message_id text,
  ADD COLUMN IF NOT EXISTS payload jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS label_sms_logs_dedupe_uidx
  ON public.label_sms_logs (restaurant_id, employee_id, dedupe_key)
  WHERE dedupe_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS label_sms_logs_restaurant_sent_idx
  ON public.label_sms_logs (restaurant_id, sent_at DESC);

CREATE TABLE IF NOT EXISTS public.whatsapp_inbound_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid,
  employee_id uuid REFERENCES public.label_employees(id) ON DELETE SET NULL,
  phone text NOT NULL,
  body text,
  provider_message_id text,
  received_at timestamptz NOT NULL DEFAULT now(),
  authorized boolean NOT NULL DEFAULT false,
  handled boolean NOT NULL DEFAULT false,
  reply text,
  raw jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.whatsapp_inbound_messages TO authenticated;
GRANT ALL ON public.whatsapp_inbound_messages TO service_role;
ALTER TABLE public.whatsapp_inbound_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members read whatsapp inbound"
ON public.whatsapp_inbound_messages FOR SELECT TO authenticated
USING (restaurant_id IS NOT NULL AND public.is_member_or_admin(restaurant_id));

CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_inbound_provider_uidx
  ON public.whatsapp_inbound_messages (provider_message_id)
  WHERE provider_message_id IS NOT NULL;
