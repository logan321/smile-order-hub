import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type SiteConfig = {
  key: string;
  value: string;
  type: 'color' | 'text' | 'image' | 'icon';
  label: string;
};

const DEFAULT_CONFIGS: Record<string, string> = {
  primary_color: '#FF5A00',
  accent_color: '#FF5A00',
  button_orcamento_text: 'ORÇAMENTO',
  view_button_text_frente: 'Frente',
  view_button_text_costas: 'Costas',
  view_button_text_lateral_esquerda: 'Lat. Esq.',
  view_button_text_lateral_direita: 'Lat. Dir.',
  icon_frente_url: '/shirt-icon.svg',
  icon_costas_url: '/shirt-icon-back.svg',
  icon_lateral_url: '/shirt-icon-side.svg',
};

export const useSiteConfig = () => {
  const { data: configs, isLoading } = useQuery({
    queryKey: ['site-config'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('site_config')
        .select('*');

      if (error) throw error;
      return data as SiteConfig[];
    },
  });

  const getConfig = (key: string): string => {
    const config = configs?.find((c) => c.key === key);
    return config?.value || DEFAULT_CONFIGS[key] || '';
  };

  return {
    configs,
    isLoading,
    getConfig,
    allConfigs: configs?.reduce((acc, curr) => ({ ...acc, [curr.key]: curr.value }), {} as Record<string, string>) || DEFAULT_CONFIGS,
  };
};
