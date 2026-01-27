-- Fix RLS policies on mesaclik.reservations to allow admin panel to create reservations

-- First, let's see what policies exist and drop them to recreate properly
DROP POLICY IF EXISTS "reservations_select" ON mesaclik.reservations;
DROP POLICY IF EXISTS "reservations_insert" ON mesaclik.reservations;
DROP POLICY IF EXISTS "reservations_update" ON mesaclik.reservations;
DROP POLICY IF EXISTS "reservations_delete" ON mesaclik.reservations;
DROP POLICY IF EXISTS "allow_all_reservations" ON mesaclik.reservations;
DROP POLICY IF EXISTS "Admins and owners can manage reservations" ON mesaclik.reservations;

-- Enable RLS if not already
ALTER TABLE mesaclik.reservations ENABLE ROW LEVEL SECURITY;

-- Create helper function to check if user is admin or restaurant owner/member
CREATE OR REPLACE FUNCTION mesaclik.is_admin_or_restaurant_member(p_restaurant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, mesaclik
AS $$
  SELECT 
    -- Is system admin
    public.is_admin(auth.uid())
    OR
    -- Is restaurant owner
    EXISTS (
      SELECT 1 FROM public.restaurants 
      WHERE id = p_restaurant_id AND owner_id = auth.uid()
    )
    OR
    -- Is restaurant member
    EXISTS (
      SELECT 1 FROM public.restaurant_members 
      WHERE restaurant_id = p_restaurant_id AND user_id = auth.uid()
    )
$$;

-- SELECT: Admins, owners, and members can view reservations for their restaurants
CREATE POLICY "reservations_select_policy" ON mesaclik.reservations
FOR SELECT
TO authenticated
USING (mesaclik.is_admin_or_restaurant_member(restaurant_id));

-- INSERT: Admins, owners, and members can create reservations for their restaurants
CREATE POLICY "reservations_insert_policy" ON mesaclik.reservations
FOR INSERT
TO authenticated
WITH CHECK (mesaclik.is_admin_or_restaurant_member(restaurant_id));

-- UPDATE: Admins, owners, and members can update reservations for their restaurants
CREATE POLICY "reservations_update_policy" ON mesaclik.reservations
FOR UPDATE
TO authenticated
USING (mesaclik.is_admin_or_restaurant_member(restaurant_id))
WITH CHECK (mesaclik.is_admin_or_restaurant_member(restaurant_id));

-- DELETE: Admins, owners, and members can delete reservations for their restaurants
CREATE POLICY "reservations_delete_policy" ON mesaclik.reservations
FOR DELETE
TO authenticated
USING (mesaclik.is_admin_or_restaurant_member(restaurant_id));