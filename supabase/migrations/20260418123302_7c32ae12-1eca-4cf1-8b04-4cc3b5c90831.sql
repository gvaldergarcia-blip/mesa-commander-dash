-- Categorias de checklist por restaurante
CREATE TABLE public.checklist_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id UUID NOT NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (restaurant_id, slug)
);

CREATE INDEX idx_checklist_categories_restaurant ON public.checklist_categories(restaurant_id);

-- Itens de checklist
CREATE TABLE public.checklist_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category_id UUID NOT NULL REFERENCES public.checklist_categories(id) ON DELETE CASCADE,
  restaurant_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  is_critical BOOLEAN NOT NULL DEFAULT false,
  requires_photo BOOLEAN NOT NULL DEFAULT false,
  display_order INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_checklist_items_category ON public.checklist_items(category_id);
CREATE INDEX idx_checklist_items_restaurant ON public.checklist_items(restaurant_id);

-- Conclusões diárias
CREATE TABLE public.checklist_completions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  item_id UUID NOT NULL REFERENCES public.checklist_items(id) ON DELETE CASCADE,
  restaurant_id UUID NOT NULL,
  completed_by UUID,
  completed_by_name TEXT,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completion_date DATE NOT NULL DEFAULT CURRENT_DATE,
  via_qr BOOLEAN NOT NULL DEFAULT false,
  photo_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_checklist_completions_item_date ON public.checklist_completions(item_id, completion_date);
CREATE INDEX idx_checklist_completions_restaurant_date ON public.checklist_completions(restaurant_id, completion_date);

-- Enable RLS
ALTER TABLE public.checklist_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checklist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checklist_completions ENABLE ROW LEVEL SECURITY;

-- Helper: is admin of restaurant
CREATE OR REPLACE FUNCTION public.is_restaurant_admin(_restaurant_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.restaurant_members
    WHERE restaurant_id = _restaurant_id
      AND user_id = auth.uid()
      AND role = 'admin'
  ) OR public.has_role(auth.uid(), 'admin'::text);
$$;

-- RLS: checklist_categories
CREATE POLICY "checklist_categories_select" ON public.checklist_categories
  FOR SELECT TO authenticated
  USING (public.is_member_or_admin(restaurant_id));

CREATE POLICY "checklist_categories_insert" ON public.checklist_categories
  FOR INSERT TO authenticated
  WITH CHECK (public.is_restaurant_admin(restaurant_id));

CREATE POLICY "checklist_categories_update" ON public.checklist_categories
  FOR UPDATE TO authenticated
  USING (public.is_restaurant_admin(restaurant_id));

CREATE POLICY "checklist_categories_delete" ON public.checklist_categories
  FOR DELETE TO authenticated
  USING (public.is_restaurant_admin(restaurant_id));

-- RLS: checklist_items
CREATE POLICY "checklist_items_select" ON public.checklist_items
  FOR SELECT TO authenticated
  USING (public.is_member_or_admin(restaurant_id));

CREATE POLICY "checklist_items_insert" ON public.checklist_items
  FOR INSERT TO authenticated
  WITH CHECK (public.is_restaurant_admin(restaurant_id));

CREATE POLICY "checklist_items_update" ON public.checklist_items
  FOR UPDATE TO authenticated
  USING (public.is_restaurant_admin(restaurant_id));

CREATE POLICY "checklist_items_delete" ON public.checklist_items
  FOR DELETE TO authenticated
  USING (public.is_restaurant_admin(restaurant_id));

-- RLS: checklist_completions (membros podem registrar)
CREATE POLICY "checklist_completions_select" ON public.checklist_completions
  FOR SELECT TO authenticated
  USING (public.is_member_or_admin(restaurant_id));

CREATE POLICY "checklist_completions_insert" ON public.checklist_completions
  FOR INSERT TO authenticated
  WITH CHECK (public.is_member_or_admin(restaurant_id));

CREATE POLICY "checklist_completions_delete" ON public.checklist_completions
  FOR DELETE TO authenticated
  USING (public.is_restaurant_admin(restaurant_id));

-- Trigger updated_at
CREATE TRIGGER trg_checklist_categories_updated
  BEFORE UPDATE ON public.checklist_categories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_checklist_items_updated
  BEFORE UPDATE ON public.checklist_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Storage bucket para fotos de conclusão
INSERT INTO storage.buckets (id, name, public)
VALUES ('checklist-photos', 'checklist-photos', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "checklist_photos_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'checklist-photos');

CREATE POLICY "checklist_photos_authenticated_upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'checklist-photos');