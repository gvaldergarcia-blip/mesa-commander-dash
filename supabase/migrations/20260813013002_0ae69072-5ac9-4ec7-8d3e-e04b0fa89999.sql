INSERT INTO public.whatsapp_notification_settings (
  restaurant_id, enabled, events, connection_status, quiet_hours_start, quiet_hours_end, dedupe_window_hours
) VALUES (
  'd2cca925-c603-457a-9aed-0d011de95d58',
  true,
  '{"validity_today": true, "validity_tomorrow": true, "validity_soon": true, "stock_out": true, "stock_below_min": true, "receipt_pending": true}'::jsonb,
  'disconnected',
  22,
  7,
  12
)
ON CONFLICT (restaurant_id) DO UPDATE SET
  enabled = true,
  events = '{"validity_today": true, "validity_tomorrow": true, "validity_soon": true, "stock_out": true, "stock_below_min": true, "receipt_pending": true}'::jsonb,
  quiet_hours_start = 22,
  quiet_hours_end = 7,
  dedupe_window_hours = 12;

INSERT INTO public.label_employees (
  restaurant_id, name, whatsapp_phone, notifications_enabled, notification_types, status, pin, role
) VALUES (
  'd2cca925-c603-457a-9aed-0d011de95d58',
  'Teste WhatsApp',
  '11944684469',
  true,
  ARRAY[]::text[],
  'active',
  '9876',
  'operador'
)
ON CONFLICT (id) DO NOTHING;