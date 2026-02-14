
-- Templates de camisa (frente e costas)
CREATE TABLE public.shirt_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  front_image_url TEXT NOT NULL,
  back_image_url TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.shirt_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner full access on shirt_templates"
  ON public.shirt_templates FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Public can read active shirt templates"
  ON public.shirt_templates FOR SELECT
  USING (active = true);

-- Catálogo de estampas
CREATE TABLE public.stamp_catalog (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Geral',
  image_url TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.stamp_catalog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner full access on stamp_catalog"
  ON public.stamp_catalog FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Public can read active stamps"
  ON public.stamp_catalog FOR SELECT
  USING (active = true);

-- Designs finalizados pelos clientes (pedidos gerados pelo editor)
CREATE TABLE public.shirt_designs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id UUID NOT NULL REFERENCES public.shirt_templates(id),
  owner_user_id UUID NOT NULL, -- dono do template (designer)
  client_name TEXT NOT NULL,
  client_phone TEXT NOT NULL DEFAULT '',
  design_data JSONB NOT NULL DEFAULT '{}', -- posições de textos, logos, estampas
  front_preview_url TEXT,
  back_preview_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.shirt_designs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner can manage shirt designs"
  ON public.shirt_designs FOR ALL
  USING (auth.uid() = owner_user_id)
  WITH CHECK (auth.uid() = owner_user_id);

CREATE POLICY "Public can insert shirt designs"
  ON public.shirt_designs FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Public can read own shirt designs"
  ON public.shirt_designs FOR SELECT
  USING (true);

-- Storage buckets
INSERT INTO storage.buckets (id, name, public) VALUES ('shirt-templates', 'shirt-templates', true);
INSERT INTO storage.buckets (id, name, public) VALUES ('stamp-catalog', 'stamp-catalog', true);
INSERT INTO storage.buckets (id, name, public) VALUES ('shirt-designs', 'shirt-designs', true);

-- Storage policies for shirt-templates
CREATE POLICY "Anyone can read shirt templates files"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'shirt-templates');

CREATE POLICY "Auth users can upload shirt templates"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'shirt-templates' AND auth.uid() IS NOT NULL);

CREATE POLICY "Auth users can delete own shirt templates"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'shirt-templates' AND auth.uid() IS NOT NULL);

-- Storage policies for stamp-catalog
CREATE POLICY "Anyone can read stamp catalog files"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'stamp-catalog');

CREATE POLICY "Auth users can upload stamps"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'stamp-catalog' AND auth.uid() IS NOT NULL);

CREATE POLICY "Auth users can delete own stamps"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'stamp-catalog' AND auth.uid() IS NOT NULL);

-- Storage policies for shirt-designs (public upload for clients)
CREATE POLICY "Anyone can read shirt design files"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'shirt-designs');

CREATE POLICY "Anyone can upload shirt design files"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'shirt-designs');
