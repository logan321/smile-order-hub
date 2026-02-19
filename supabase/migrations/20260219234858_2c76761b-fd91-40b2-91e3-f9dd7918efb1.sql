
-- Table for stamp color variants
CREATE TABLE public.stamp_colors (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  stamp_id uuid NOT NULL REFERENCES public.stamp_catalog(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  color_name text NOT NULL,
  color_hex text NOT NULL DEFAULT '#000000',
  image_url text NOT NULL,
  back_image_url text,
  position integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.stamp_colors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner full access on stamp_colors"
ON public.stamp_colors FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can manage all stamp_colors"
ON public.stamp_colors FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Public can read stamp_colors"
ON public.stamp_colors FOR SELECT
USING (true);
