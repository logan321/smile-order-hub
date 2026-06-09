import React, { createContext, useContext, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { SiteConfig } from '@/types/siteConfig';

export const DEFAULT_CONFIGS: Record<string, string> = {
  // Cores originais
  primary_color: '#FF5A00',
  accent_color: '#FF5A00',
  sidebar_bg_color: '#ffffff',
  background_color: '#F8F9FA',
  header_bg_color: '#ffffff',
  header_text_color: '#1a1a1a',
  text_primary_color: '#1a1a1a',
  text_secondary_color: '#6b7280',
  border_color: '#e5e7eb',
  canvas_bg_color: '#F1F5F9',
  sidebar_text_color: '#1a1a1a',
  
  // Textos originais
  app_title: 'MACRO MASTER',
  orcamento_button_text: 'ORÇAMENTO',
  resetar_design_text: 'Resetar Design',
  ver_todas_estampas_text: 'VER TODAS AS ESTAMPAS',
  config_estampa_title: 'CONFIGURAÇÕES DE ESTAMPA',
  estampa_tab_label: 'ESTAMPA',
  texto_tab_label: 'TEXTO',
  nome_tab_label: 'NOME',
  acabamento_tab_label: 'ACABAMENTO',
  escudo_tab_label: 'ESCUDO',
  numero_tab_label: 'NÚMERO',
  upload_tab_label: 'UPLOAD',
  modo_simulador_label: 'MODO: 3D SIMULATOR V2',
  sincronizacao_label: 'SINCRONIZAÇÃO REALTIME',
  girar_button_text: 'Girar',
  pausar_button_text: 'Pausar',
  placeholder_nome: 'SEU NOME',
  placeholder_numero: '10',
  
  // Ícones originais
  icon_frente: 'Shirt',
  icon_costas: 'Shirt',
  icon_lateral: 'Shirt',
  icon_reset: 'RotateCcw',
  icon_download: 'Download',
  
  // Layout original
  sidebar_width: '320px',
  border_radius_buttons: '12px',
};

interface SiteConfigContextType {
  configs: Record<string, string>;
  allConfigs: SiteConfig[];
  isLoading: boolean;
  refresh: () => void;
  getConfig: (key: string) => string;
}

const SiteConfigContext = createContext<SiteConfigContextType | undefined>(undefined);

export const SiteConfigProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { data: configsData, isLoading, refetch } = useQuery({
    queryKey: ['site-config-full'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('site_config')
        .select('*');
      if (error) throw error;
      return data as SiteConfig[];
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const configsMap = useMemo(() => {
    const map: Record<string, string> = { ...DEFAULT_CONFIGS };
    
    if (configsData) {
      configsData.forEach((curr) => {
        const value = curr.value?.trim();
        if (value) {
          map[curr.key] = value;
        }
      });
    }
    
    return map;
  }, [configsData]);

  const getConfig = (key: string): string => {
    return configsMap[key] || DEFAULT_CONFIGS[key] || '';
  };

  const value = useMemo(() => ({
    configs: configsMap,
    allConfigs: configsData || [],
    isLoading,
    refresh: refetch,
    getConfig
  }), [configsMap, configsData, isLoading, refetch]);

  return (
    <SiteConfigContext.Provider value={value}>
      {children}
    </SiteConfigContext.Provider>
  );
};

export const useSiteConfigContext = () => {
  const context = useContext(SiteConfigContext);
  if (context === undefined) {
    throw new Error('useSiteConfigContext must be used within a SiteConfigProvider');
  }
  return context;
};
