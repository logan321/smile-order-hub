-- Seed default mobile configurations
INSERT INTO public.site_config (key, value, type, label, category)
VALUES 
  ('mobile_primary_color', '#FF5A00', 'color', 'Cor Primária (Mobile)', 'mobile_config'),
  ('mobile_accent_color', '#FF5A00', 'color', 'Cor de Destaque (Mobile)', 'mobile_config'),
  ('mobile_background_color', '#F8F9FA', 'color', 'Cor de Fundo (Mobile)', 'mobile_config'),
  ('mobile_app_title', 'SIMULADOR MOBILE', 'text', 'Título do App (Mobile)', 'mobile_config'),
  ('mobile_orcamento_button_text', 'SOLICITAR ORÇAMENTO', 'text', 'Texto Botão Orçamento (Mobile)', 'mobile_config'),
  ('mobile_resetar_design_text', 'Limpar Design', 'text', 'Texto Resetar (Mobile)', 'mobile_config')
ON CONFLICT (key) DO NOTHING;
