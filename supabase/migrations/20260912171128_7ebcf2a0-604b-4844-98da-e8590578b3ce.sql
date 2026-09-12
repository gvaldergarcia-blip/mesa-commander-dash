CREATE OR REPLACE FUNCTION public.sync_plan_modules_list_to_mesaclik()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, mesaclik
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM mesaclik.restaurants m
    WHERE m.id = NEW.id
      AND m.plan_modules_list IS NOT DISTINCT FROM NEW.plan_modules_list
  ) THEN
    RETURN NEW;
  END IF;

  UPDATE mesaclik.restaurants
  SET plan_modules_list = NEW.plan_modules_list
  WHERE id = NEW.id;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_plan_modules_list_to_public()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, mesaclik
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.restaurants p
    WHERE p.id = NEW.id
      AND p.plan_modules_list IS NOT DISTINCT FROM NEW.plan_modules_list
  ) THEN
    RETURN NEW;
  END IF;

  UPDATE public.restaurants
  SET plan_modules_list = NEW.plan_modules_list
  WHERE id = NEW.id;

  RETURN NEW;
END;
$$;