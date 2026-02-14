
-- Catalog of patches ("peixes") that can be auto-placed in zones
CREATE TABLE public.patch_catalog (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  image_url TEXT NOT NULL,
  target_zone_name TEXT NOT NULL DEFAULT '',
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.patch_catalog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner full access on patch_catalog"
  ON public.patch_catalog FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Public can read active patches"
  ON public.patch_catalog FOR SELECT
  USING (active = true);
