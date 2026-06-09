import React, { createContext, useContext, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type SiteConfig = {
  key: string;
  value: string;
  type: string;
  label: string;
  category: string;
};

interface SiteConfigContextType {
  configs: Record<string, string>;
  allConfigs: SiteConfig[];
  isLoading: boolean;
  refresh: () => void;
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
    if (!configsData) return {};
    return configsData.reduce((acc, curr) => {
      acc[curr.key] = curr.value;
      return acc;
    }, {} as Record<string, string>);
  }, [configsData]);

  const value = useMemo(() => ({
    configs: configsMap,
    allConfigs: configsData || [],
    isLoading,
    refresh: refetch
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
