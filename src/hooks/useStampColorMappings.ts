import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface StampColorMapping {
  id: string;
  stamp_id: string;
  original_color: string;
  region_name: string;
  is_editable: boolean;
  sort_order: number;
}

export function useStampColorMappings(stampId: string | undefined | null) {
  return useQuery({
    queryKey: ['stamp-color-mappings', stampId],
    queryFn: async () => {
      if (!stampId) return [];
      const { data, error } = await supabase
        .from('uv_color_mappings')
        .select('id, stamp_id, original_color, region_name, is_editable, sort_order')
        .eq('stamp_id', stampId)
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return (data || []) as StampColorMapping[];
    },
    enabled: !!stampId,
    staleTime: 1000 * 60 * 5,
  });
}