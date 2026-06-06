import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface UvColorMapping {
  id: string;
  template_id: string;
  original_color: string;
  region_name: string;
  sort_order: number;
}

export function useUvColorMappings(templateId: string | undefined | null) {
  return useQuery({
    queryKey: ['uv-color-mappings', templateId],
    queryFn: async () => {
      if (!templateId) return [];
      
      const { data, error } = await supabase
        .from('uv_color_mappings')
        .select('*')
        .eq('template_id', templateId)
        .order('sort_order', { ascending: true });

      if (error) throw error;
      return data as UvColorMapping[];
    },
    enabled: !!templateId,
    staleTime: 1000 * 60 * 5,
  });
}
