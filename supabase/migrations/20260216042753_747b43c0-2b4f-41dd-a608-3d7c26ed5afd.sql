
-- Create text_styles table for text style templates (PNG images with style previews)
CREATE TABLE public.text_styles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Geral',
  image_url TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.text_styles ENABLE ROW LEVEL SECURITY;

-- Owner full access
CREATE POLICY "Owner full access on text_styles"
  ON public.text_styles FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Admins can manage all
CREATE POLICY "Admins can manage all text_styles"
  ON public.text_styles FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Public can read active styles (for the public editor)
CREATE POLICY "Public can read active text_styles"
  ON public.text_styles FOR SELECT
  USING (active = true);

-- Create storage bucket for text style images
INSERT INTO storage.buckets (id, name, public) VALUES ('text-styles', 'text-styles', true);

-- Storage policies
CREATE POLICY "Anyone can read text-styles"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'text-styles');

CREATE POLICY "Authenticated users can upload text-styles"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'text-styles' AND auth.role() = 'authenticated');

CREATE POLICY "Users can delete own text-styles"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'text-styles' AND auth.role() = 'authenticated');
