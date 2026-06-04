CREATE TABLE public.emblems (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  category text,
  image_url text NOT NULL,
  niche_id uuid REFERENCES public.niches(id) ON DELETE SET NULL,
  active boolean NOT NULL DEFAULT true,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.emblems TO authenticated;
GRANT SELECT ON public.emblems TO anon;
GRANT ALL ON public.emblems TO service_role;

ALTER TABLE public.emblems ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owners manage own emblems"
  ON public.emblems
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "public can read active emblems"
  ON public.emblems
  FOR SELECT
  TO anon, authenticated
  USING (active = true);

CREATE TRIGGER emblems_set_updated_at
  BEFORE UPDATE ON public.emblems
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX emblems_user_id_idx ON public.emblems(user_id);
CREATE INDEX emblems_niche_id_idx ON public.emblems(niche_id);