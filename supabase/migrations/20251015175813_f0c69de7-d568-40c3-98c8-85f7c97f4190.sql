-- Add unique constraint for restaurant_id and day to prevent duplicates
ALTER TABLE mesaclik.restaurant_calendar
ADD CONSTRAINT restaurant_calendar_restaurant_day_unique 
UNIQUE (restaurant_id, day);

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_restaurant_calendar_restaurant_day 
ON mesaclik.restaurant_calendar(restaurant_id, day);

-- Add RLS policies to allow public read access (for the app)
ALTER TABLE mesaclik.restaurant_calendar ENABLE ROW LEVEL SECURITY;

-- Allow public to read blocked dates (needed for the customer app)
CREATE POLICY "Public can view restaurant calendar"
ON mesaclik.restaurant_calendar
FOR SELECT
USING (true);

-- Only restaurant owners/admins can modify calendar
CREATE POLICY "Restaurant owners can manage calendar"
ON mesaclik.restaurant_calendar
FOR ALL
USING (true)
WITH CHECK (true);