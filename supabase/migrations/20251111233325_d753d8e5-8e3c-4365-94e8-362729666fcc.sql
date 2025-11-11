-- Add UPDATE policy for restaurant_terms_acceptance
CREATE POLICY "terms_restaurant_update" 
ON mesaclik.restaurant_terms_acceptance
FOR UPDATE
TO public
USING (true)
WITH CHECK (true);