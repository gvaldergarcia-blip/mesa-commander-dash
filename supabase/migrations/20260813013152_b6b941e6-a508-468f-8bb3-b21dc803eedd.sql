UPDATE public.whatsapp_notification_settings
SET quiet_hours_start = 0, quiet_hours_end = 0, updated_at = now()
WHERE restaurant_id = 'd2cca925-c603-457a-9aed-0d011de95d58';