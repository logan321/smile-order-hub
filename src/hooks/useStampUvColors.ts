import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface StampColorMapping {
  id: string;
  stamp_id: string;
  original_color: string;
  region_name: string;
  is_editable: boolean;
  sort_order: number;
}

export function useStampUvColors(stampId: string | undefined) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['stamp-uv-colors', stampId],
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
  });

  const saveMappings = useMutation({
    mutationFn: async (mappings: Omit<StampColorMapping, 'id'>[]) => {
      if (!stampId) throw new Error('Stamp ID is required');

      // Simple approach: delete existing and insert new
      const { error: deleteError } = await supabase
        .from('stamp_color_mappings')
        .delete()
        .eq('stamp_id', stampId);

      if (deleteError) throw deleteError;

      if (mappings.length > 0) {
        const { error: insertError } = await supabase
          .from('stamp_color_mappings')
          .insert(mappings);
        if (insertError) throw insertError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stamp-uv-colors', stampId] });
      toast.success('Mapeamento de cores salvo!');
    },
    onError: (error: any) => {
      toast.error('Erro ao salvar mapeamento: ' + error.message);
    }
  });

  return {
    ...query,
    saveMappings
  };
}
