CREATE OR REPLACE FUNCTION public.redirect_stamp_like_template()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  looks_like_stamp_code boolean;
  looks_like_stamp_asset boolean;
  category_name text;
BEGIN
  looks_like_stamp_code := NEW.name ~* '^[A-Za-z]{0,6}[-_.]?[0-9]{1,6}[A-Za-z]{0,3}$';
  looks_like_stamp_asset := NEW.uv_map_url IS NOT NULL
    OR NEW.front_image_url ~* 'colorway|estampa|stamp'
    OR NEW.back_image_url ~* 'colorway|estampa|stamp';

  IF looks_like_stamp_code AND looks_like_stamp_asset THEN
    SELECT COALESCE(n.name, 'Geral')
    INTO category_name
    FROM public.niches n
    WHERE n.id = NEW.niche_id;

    INSERT INTO public.stamp_catalog (
      user_id,
      name,
      category,
      image_url,
      back_image_url,
      uv_map_url,
      niche_id,
      active
    )
    SELECT
      NEW.user_id,
      NEW.name,
      COALESCE(category_name, 'Geral'),
      NEW.front_image_url,
      NEW.back_image_url,
      NEW.uv_map_url,
      NEW.niche_id,
      true
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.stamp_catalog s
      WHERE s.user_id = NEW.user_id
        AND s.name = NEW.name
        AND s.image_url = NEW.front_image_url
    );

    NEW.active := false;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS redirect_stamp_like_template_before_insert ON public.shirt_templates;
CREATE TRIGGER redirect_stamp_like_template_before_insert
BEFORE INSERT ON public.shirt_templates
FOR EACH ROW
EXECUTE FUNCTION public.redirect_stamp_like_template();