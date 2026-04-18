-- Allow any restaurant member (admin or operator) to manage checklists.
-- The user explicitly chose "Ambos sem restrição de modo" so both roles can edit.

DROP POLICY IF EXISTS "checklist_categories_insert" ON public.checklist_categories;
DROP POLICY IF EXISTS "checklist_categories_update" ON public.checklist_categories;
DROP POLICY IF EXISTS "checklist_categories_delete" ON public.checklist_categories;

CREATE POLICY "checklist_categories_insert" ON public.checklist_categories
  FOR INSERT TO authenticated
  WITH CHECK (public.is_member_or_admin(restaurant_id));

CREATE POLICY "checklist_categories_update" ON public.checklist_categories
  FOR UPDATE TO authenticated
  USING (public.is_member_or_admin(restaurant_id));

CREATE POLICY "checklist_categories_delete" ON public.checklist_categories
  FOR DELETE TO authenticated
  USING (public.is_member_or_admin(restaurant_id));

DROP POLICY IF EXISTS "checklist_items_insert" ON public.checklist_items;
DROP POLICY IF EXISTS "checklist_items_update" ON public.checklist_items;
DROP POLICY IF EXISTS "checklist_items_delete" ON public.checklist_items;

CREATE POLICY "checklist_items_insert" ON public.checklist_items
  FOR INSERT TO authenticated
  WITH CHECK (public.is_member_or_admin(restaurant_id));

CREATE POLICY "checklist_items_update" ON public.checklist_items
  FOR UPDATE TO authenticated
  USING (public.is_member_or_admin(restaurant_id));

CREATE POLICY "checklist_items_delete" ON public.checklist_items
  FOR DELETE TO authenticated
  USING (public.is_member_or_admin(restaurant_id));

DROP POLICY IF EXISTS "checklist_completions_delete" ON public.checklist_completions;

CREATE POLICY "checklist_completions_delete" ON public.checklist_completions
  FOR DELETE TO authenticated
  USING (public.is_member_or_admin(restaurant_id));