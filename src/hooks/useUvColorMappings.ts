import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface UvColorMapping {
  id: string;
  uv_map_id: string;
  original_color: string;
  region_name: string;
  sort_order: number;
}

export function useUvColorMappings(uvMapId: string | undefined | null) {
  return useQuery({
    queryKey: ['uv-color-mappings', uvMapId],
    queryFn: async () => {
      if (!uvMapId) return [];
      
      const { data, error } = await supabase
        .from('uv_color_mappings')
        .select('*')
        .eq('uv_map_id', uvMapId)
        .order('sort_order', { ascending: true });

      if (error) throw error;
      return data as UvColorMapping[];
    },
    enabled: !!uvMapId,
    staleTime: 1000 * 60 * 5,
  });
}
