import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export interface TemplateColorMapping {
  id: string;
  template_id: string;
  original_color: string;
  region_name: string;
  sort_order: number;
}

export function useTemplateColors(templateId: string | undefined) {
  return useQuery({
    queryKey: ['template-colors', templateId],
    queryFn: async () => {
      if (!templateId) return [];
      
      const { data, error } = await supabase
        .from('template_color_mappings')
        .select('*')
        .eq('template_id', templateId)
        .order('sort_order', { ascending: true });

      if (error) throw error;
      return data as TemplateColorMapping[];
    },
    enabled: !!templateId,
    staleTime: 1000 * 60 * 5, // 5 minutes cache
  });
}
