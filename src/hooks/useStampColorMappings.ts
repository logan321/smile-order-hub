import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface StampColorMapping {
  id: string;
  stamp_id: string;
  original_color: string;
  region_name: string;
  sort_order: number;
}

export function useStampColorMappings(stampId: string | undefined) {
  return useQuery({
    queryKey: ['stamp-color-mappings', stampId],
    queryFn: async () => {
      if (!stampId) return [];
      
      const { data, error } = await supabase
        .from('stamp_color_mappings')
        .select('*')
        .eq('stamp_id', stampId)
        .order('sort_order', { ascending: true });

      if (error) throw error;
      return data as StampColorMapping[];
    },
    enabled: !!stampId,
    staleTime: 1000 * 60 * 5,
  });
}
