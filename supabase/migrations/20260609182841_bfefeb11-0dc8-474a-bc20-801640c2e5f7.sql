-- Drop the existing constraint
ALTER TABLE public.site_config DROP CONSTRAINT IF EXISTS site_config_type_check;

-- Add category column to site_config
ALTER TABLE public.site_config ADD COLUMN IF NOT EXISTS category TEXT;

-- Update existing rows categories if they exist
UPDATE public.site_config SET category = 'cores' WHERE key IN ('primary_color', 'accent_color');
UPDATE public.site_config SET category = 'textos' WHERE key IN ('button_orcamento_text', 'view_button_text_frente', 'view_button_text_costas', 'view_button_text_lateral_esquerda', 'view_button_text_lateral_direita');
UPDATE public.site_config SET category = 'ícones' WHERE key IN ('icon_frente_url', 'icon_costas_url', 'icon_lateral_url');

-- Upsert initial configurations
INSERT INTO public.site_config (key, value, type, label, category)
VALUES 
  -- CORES
  ('primary_color', '#FF5A00', 'color', 'Cor Primária', 'cores'),
  ('secondary_color', '#1a1a1a', 'color', 'Cor Secundária', 'cores'),
  ('background_color', '#f8f9fa', 'color', 'Fundo Geral', 'cores'),
  ('sidebar_bg_color', '#ffffff', 'color', 'Fundo da Sidebar', 'cores'),
  ('sidebar_text_color', '#1a1a1a', 'color', 'Texto da Sidebar', 'cores'),
  ('header_bg_color', '#ffffff', 'color', 'Fundo do Header', 'cores'),
  ('header_text_color', '#1a1a1a', 'color', 'Texto do Header', 'cores'),
  ('accent_color', '#FF5A00', 'color', 'Cor de Destaque', 'cores'),
  ('text_primary_color', '#1a1a1a', 'color', 'Texto Principal', 'cores'),
  ('text_secondary_color', '#6c757d', 'color', 'Texto Secundário', 'cores'),
  ('border_color', '#dee2e6', 'color', 'Cor de Borda', 'cores'),
  ('shadow_color', 'rgba(0,0,0,0.1)', 'color', 'Cor da Sombra', 'cores'),
  ('canvas_bg_color', '#e9ecef', 'color', 'Fundo do Simulador 3D', 'cores'),

  -- TEXTOS
  ('app_title', 'MACRO MASTER', 'text', 'Título do App', 'textos'),
  ('orcamento_button_text', 'ORÇAMENTO', 'text', 'Botão Orçamento', 'textos'),
  ('resetar_design_text', 'Resetar Design', 'text', 'Botão Resetar', 'textos'),
  ('ver_todas_estampas_text', 'Ver todas as estampas', 'text', 'Ver Todas Estampas', 'textos'),
  ('config_estampa_title', 'CONFIGURAÇÕES DE ESTAMPA', 'text', 'Título Config Estampa', 'textos'),
  ('estampa_tab_label', 'ESTAMPA', 'text', 'Aba Estampa', 'textos'),
  ('texto_tab_label', 'TEXTO', 'text', 'Aba Texto', 'textos'),
  ('nome_tab_label', 'NOME', 'text', 'Aba Nome', 'textos'),
  ('acabamento_tab_label', 'ACABAMENTO', 'text', 'Aba Acabamento', 'textos'),
  ('escudo_tab_label', 'ESCUDO', 'text', 'Aba Escudo', 'textos'),
  ('numero_tab_label', 'NÚMERO', 'text', 'Aba Número', 'textos'),
  ('upload_tab_label', 'UPLOAD', 'text', 'Aba Upload', 'textos'),
  ('modo_simulador_label', 'MODO: 3D SIMULATOR V2', 'text', 'Label Modo Simulador', 'textos'),
  ('sincronizacao_label', 'SINCRONIZAÇÃO REALTIME', 'text', 'Label Sincronização', 'textos'),
  ('girar_button_text', 'Girar', 'text', 'Botão Girar', 'textos'),
  ('pausar_button_text', 'Pausar', 'text', 'Botão Pausar', 'textos'),
  ('placeholder_nome', 'SEU NOME', 'text', 'Placeholder Nome', 'textos'),
  ('placeholder_numero', '10', 'text', 'Placeholder Número', 'textos'),
  ('sem_estampa_text', 'Nenhuma estampa selecionada', 'text', 'Texto Sem Estampa', 'textos'),

  -- ÍCONES
  ('icon_frente_url', '/shirt-icon.svg', 'icon', 'Ícone Frente', 'ícones'),
  ('icon_costas_url', '/shirt-icon-back.svg', 'icon', 'Ícone Costas', 'ícones'),
  ('icon_lateral_direita_url', '/shirt-icon-side.svg', 'icon', 'Ícone Lat. Dir.', 'ícones'),
  ('icon_lateral_esquerda_url', '/shirt-icon-side.svg', 'icon', 'Ícone Lat. Esq.', 'ícones'),
  ('icon_reset_url', '', 'icon', 'Ícone Resetar', 'ícones'),
  ('icon_download_url', '', 'icon', 'Ícone Download', 'ícones'),
  ('icon_orcamento_url', '', 'icon', 'Ícone Orçamento', 'ícones'),
  ('icon_estampa_tab_url', '', 'icon', 'Ícone Aba Estampa', 'ícones'),
  ('icon_texto_tab_url', '', 'icon', 'Ícone Aba Texto', 'ícones'),
  ('icon_nome_tab_url', '', 'icon', 'Ícone Aba Nome', 'ícones'),
  ('icon_acabamento_tab_url', '', 'icon', 'Ícone Aba Acabamento', 'ícones'),
  ('icon_escudo_tab_url', '', 'icon', 'Ícone Aba Escudo', 'ícones'),
  ('icon_numero_tab_url', '', 'icon', 'Ícone Aba Número', 'ícones'),
  ('icon_upload_tab_url', '', 'icon', 'Ícone Aba Upload', 'ícones'),
  ('logo_url', '/logo.png', 'image', 'Logo do Topo', 'ícones'),

  -- LAYOUT
  ('sidebar_width', '320px', 'layout', 'Largura da Sidebar', 'layout'),
  ('border_radius_buttons', '12px', 'layout', 'Arredondamento Botões', 'layout'),
  ('font_family', 'Inter', 'layout', 'Fonte do Site', 'layout'),
  ('font_size_base', '16px', 'layout', 'Tamanho Fonte Base', 'layout')
ON CONFLICT (key) DO UPDATE 
SET 
  label = EXCLUDED.label,
  category = EXCLUDED.category,
  type = EXCLUDED.type;
