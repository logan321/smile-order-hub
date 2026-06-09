CREATE TABLE public.site_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  value TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('color', 'text', 'image', 'icon')),
  label TEXT NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT ON public.site_config TO anon, authenticated;
GRANT ALL ON public.site_config TO authenticated;
GRANT ALL ON public.site_config TO service_role;

ALTER TABLE public.site_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access" ON public.site_config FOR SELECT USING (true);
CREATE POLICY "Allow authenticated update" ON public.site_config FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- Insert default values
INSERT INTO public.site_config (key, value, type, label) VALUES
('primary_color', '#FF5A00', 'color', 'Cor Primária (Botões)'),
('accent_color', '#FF5A00', 'color', 'Cor de Destaque (Bordas)'),
('button_orcamento_text', 'ORÇAMENTO', 'text', 'Texto do Botão Orçamento'),
('view_button_text_frente', 'Frente', 'text', 'Texto do Botão Frente'),
('view_button_text_costas', 'Costas', 'text', 'Texto do Botão Costas'),
('view_button_text_lateral_esquerda', 'Lat. Esq.', 'text', 'Texto do Botão Lateral Esquerda'),
('view_button_text_lateral_direita', 'Lat. Dir.', 'text', 'Texto do Botão Lateral Direita'),
('icon_frente_url', '/shirt-icon.svg', 'icon', 'Ícone Vista Frente'),
('icon_costas_url', '/shirt-icon-back.svg', 'icon', 'Ícone Vista Costas'),
('icon_lateral_url', '/shirt-icon-side.svg', 'icon', 'Ícone Vista Lateral');

CREATE OR REPLACE FUNCTION public.update_site_config_updated_at() RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_site_config_updated_at
BEFORE UPDATE ON public.site_config
FOR EACH ROW
EXECUTE FUNCTION public.update_site_config_updated_at();