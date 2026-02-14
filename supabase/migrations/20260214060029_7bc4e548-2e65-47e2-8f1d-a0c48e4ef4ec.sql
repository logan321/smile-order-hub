
CREATE TABLE public.template_zones (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id UUID NOT NULL REFERENCES public.shirt_templates(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  side TEXT NOT NULL DEFAULT 'front',
  x_percent NUMERIC NOT NULL DEFAULT 0,
  y_percent NUMERIC NOT NULL DEFAULT 0,
  width_percent NUMERIC NOT NULL DEFAULT 20,
  height_percent NUMERIC NOT NULL DEFAULT 20,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.template_zones ENABLE ROW LEVEL SECURITY;

-- Anyone can view zones (public editor needs them)
CREATE POLICY "Anyone can view template zones"
ON public.template_zones
FOR SELECT
USING (true);

-- Only owners can manage zones
CREATE POLICY "Users can insert their own zones"
ON public.template_zones
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own zones"
ON public.template_zones
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own zones"
ON public.template_zones
FOR DELETE
USING (auth.uid() = user_id);
