
-- Add SMS notification preferences to label_employees
ALTER TABLE public.label_employees
  ADD COLUMN IF NOT EXISTS sms_daily_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sms_daily_hour int NOT NULL DEFAULT 8,
  ADD COLUMN IF NOT EXISTS sms_immediate_alerts boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS sms_include_checklists boolean NOT NULL DEFAULT false;

ALTER TABLE public.label_employees
  ADD CONSTRAINT label_employees_sms_hour_chk CHECK (sms_daily_hour BETWEEN 0 AND 23);

-- SMS log table
CREATE TABLE IF NOT EXISTS public.label_sms_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL,
  employee_id uuid NULL REFERENCES public.label_employees(id) ON DELETE SET NULL,
  phone text NOT NULL,
  message text NOT NULL,
  kind text NOT NULL DEFAULT 'daily',
  status text NOT NULL DEFAULT 'sent',
  error text NULL,
  triggered_label_id uuid NULL,
  sent_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS label_sms_logs_restaurant_idx ON public.label_sms_logs(restaurant_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS label_sms_logs_employee_idx ON public.label_sms_logs(employee_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS label_sms_logs_triggered_idx ON public.label_sms_logs(triggered_label_id) WHERE triggered_label_id IS NOT NULL;

GRANT SELECT, INSERT ON public.label_sms_logs TO authenticated;
GRANT ALL ON public.label_sms_logs TO service_role;

ALTER TABLE public.label_sms_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members read sms logs"
ON public.label_sms_logs FOR SELECT
TO authenticated
USING (public.is_member_or_admin(restaurant_id));

CREATE POLICY "members insert sms logs"
ON public.label_sms_logs FOR INSERT
TO authenticated
WITH CHECK (public.is_member_or_admin(restaurant_id));
