import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface UvColorMapping {
  id: string;
  template_id: string;
  original_color: string;
  region_name: string;
  sort_order: number;
}

export function useUvColorMap(templateId: string | undefined | null) {
  return useQuery({
    queryKey: ['uv-color-mappings', templateId],
    queryFn: async () => {
      if (!templateId) return [];
      
      const { data, error } = await supabase
        .from('uv_color_mappings')
        .select('original_color, region_name, sort_order')
        .eq('template_id', templateId)
        .order('sort_order', { ascending: true });

      if (error) throw error;
      return data as Pick<UvColorMapping, 'original_color' | 'region_name' | 'sort_order'>[];
    },
    enabled: !!templateId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}
