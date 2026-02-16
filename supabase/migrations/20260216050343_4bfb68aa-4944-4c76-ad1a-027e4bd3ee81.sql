
-- Create niches table
CREATE TABLE public.niches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT '🏷️',
  patch_label TEXT NOT NULL DEFAULT 'Emblemas',
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.niches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner full access on niches" ON public.niches FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can manage all niches" ON public.niches FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Public can read niches" ON public.niches FOR SELECT
  USING (true);

-- Add niche_id to shirt_templates (nullable for backward compat)
ALTER TABLE public.shirt_templates ADD COLUMN niche_id UUID REFERENCES public.niches(id) ON DELETE SET NULL;

-- Add niche_id to stamp_catalog
ALTER TABLE public.stamp_catalog ADD COLUMN niche_id UUID REFERENCES public.niches(id) ON DELETE SET NULL;

-- Add niche_id to patch_catalog
ALTER TABLE public.patch_catalog ADD COLUMN niche_id UUID REFERENCES public.niches(id) ON DELETE SET NULL;
