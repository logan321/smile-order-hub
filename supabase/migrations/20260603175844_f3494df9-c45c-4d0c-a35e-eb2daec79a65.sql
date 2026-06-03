
-- 1. Tabela uv_maps
CREATE TABLE public.uv_maps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  code text NOT NULL,
  name text,
  image_url text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, code)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.uv_maps TO authenticated;
GRANT ALL ON public.uv_maps TO service_role;

ALTER TABLE public.uv_maps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own uv_maps"
  ON public.uv_maps FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER uv_maps_updated_at
  BEFORE UPDATE ON public.uv_maps
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Vincular estampas e templates ao uv da biblioteca
ALTER TABLE public.stamp_catalog
  ADD COLUMN uv_map_id uuid REFERENCES public.uv_maps(id) ON DELETE SET NULL;

ALTER TABLE public.shirt_templates
  ADD COLUMN uv_map_id uuid REFERENCES public.uv_maps(id) ON DELETE SET NULL;

-- 3. Zonas passam a referenciar UV (template_id continua existindo p/ legado)
ALTER TABLE public.template_zones
  ADD COLUMN uv_map_id uuid REFERENCES public.uv_maps(id) ON DELETE CASCADE,
  ALTER COLUMN template_id DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_template_zones_uv_map_id ON public.template_zones(uv_map_id);

-- 4. Migrar UVs existentes (templates)
DO $$
DECLARE
  r RECORD;
  new_uv_id uuid;
  counter int;
BEGIN
  FOR r IN SELECT id, user_id, name, uv_map_url FROM public.shirt_templates WHERE uv_map_url IS NOT NULL LOOP
    SELECT COALESCE(MAX(NULLIF(regexp_replace(code, '\D', '', 'g'), '')::int), 0) + 1
      INTO counter FROM public.uv_maps WHERE user_id = r.user_id;
    INSERT INTO public.uv_maps (user_id, code, name, image_url)
      VALUES (r.user_id, 'UV-' || LPAD(counter::text, 3, '0'), r.name, r.uv_map_url)
      RETURNING id INTO new_uv_id;
    UPDATE public.shirt_templates SET uv_map_id = new_uv_id WHERE id = r.id;
    UPDATE public.template_zones SET uv_map_id = new_uv_id WHERE template_id = r.id;
  END LOOP;

  FOR r IN SELECT id, user_id, name, uv_map_url FROM public.stamp_catalog WHERE uv_map_url IS NOT NULL LOOP
    SELECT COALESCE(MAX(NULLIF(regexp_replace(code, '\D', '', 'g'), '')::int), 0) + 1
      INTO counter FROM public.uv_maps WHERE user_id = r.user_id;
    INSERT INTO public.uv_maps (user_id, code, name, image_url)
      VALUES (r.user_id, 'UV-' || LPAD(counter::text, 3, '0'), r.name, r.uv_map_url)
      RETURNING id INTO new_uv_id;
    UPDATE public.stamp_catalog SET uv_map_id = new_uv_id WHERE id = r.id;
  END LOOP;
END $$;
