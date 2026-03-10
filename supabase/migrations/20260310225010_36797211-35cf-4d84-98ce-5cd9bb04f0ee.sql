
ALTER TABLE public.customer_loyalty_status
ADD COLUMN IF NOT EXISTS custom_required_visits integer DEFAULT NULL,
ADD COLUMN IF NOT EXISTS custom_reward_description text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS custom_reward_validity_days integer DEFAULT NULL,
ADD COLUMN IF NOT EXISTS reminder_2_sent boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS reminder_3_sent boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS reminder_4_sent boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS reminder_5_sent boolean NOT NULL DEFAULT false;
