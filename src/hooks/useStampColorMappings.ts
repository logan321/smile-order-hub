import { useState, useEffect, useCallback } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { toast } from 'sonner';

export interface StampColorMapping {
  id?: string;
  stamp_id: string;
  original_color: string;
  region_name: string;
  is_editable: boolean;
  sort_order: number;
  created_at?: string;
  updated_at?: string;
}

export type NewStampColorMapping = Omit<StampColorMapping, 'id' | 'stamp_id' | 'created_at' | 'updated_at'>;

export function useStampColorMappings(stampId: string | null) {
  const [mappings, setMappings] = useState<StampColorMapping[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchMappings = useCallback(async () => {
    if (!stampId) {
      setMappings([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('stamp_color_mappings')
        .select('*')
        .eq('stamp_id', stampId)
        .order('sort_order', { ascending: true });

      if (error) throw error;
      setMappings(data || []);
    } catch (err: any) {
      console.error('Error fetching stamp color mappings:', err);
      toast.error('Erro ao carregar mapeamentos de cores');
    } finally {
      setIsLoading(false);
    }
  }, [stampId]);

  useEffect(() => {
    fetchMappings();
  }, [fetchMappings]);

  const saveMappings = useCallback(async (newMappings: NewStampColorMapping[]) => {
    if (!stampId) {
      return;
    }

    const mappingsToSave = newMappings.map(m => ({
      ...m,
      stamp_id: stampId
    }));

    try {
      const { error } = await supabase
        .from('stamp_color_mappings')
        .upsert(mappingsToSave, { 
          onConflict: 'stamp_id,original_color' 
        });

      if (error) throw error;
      
      toast.success('Mapeamento de cores salvo com sucesso');
      await fetchMappings();
    } catch (err: any) {
      console.error('Error saving stamp color mappings:', err);
      toast.error('Erro ao salvar mapeamento de cores');
      throw err;
    }
  }, [stampId, fetchMappings]);

  return { 
    mappings, 
    isLoading, 
    saveMappings: stampId ? saveMappings : async () => {} 
  };
}
