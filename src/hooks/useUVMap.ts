import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface UVMap {
  id: string;
  codigo: string;
  uv_frente_url: string;
  uv_costas_url: string;
}

export function useUVMap(codigo: string | null | undefined) {
  return useQuery({
    queryKey: ['uv-map', codigo],
    queryFn: async (): Promise<UVMap | null> => {
      if (!codigo) return null;

      const { data, error } = await supabase
        .from('uv_data')
        .select('id, codigo, uv_frente_url, uv_costas_url')
        .eq('codigo', codigo)
        .maybeSingle();

      if (error) {
        console.error('Erro ao buscar UV Map:', error);
        throw error;
      }

      if (!data) {
        console.warn(`Aviso: Nenhum UV Map encontrado para o código: ${codigo}`);
        return null;
      }

      return data as UVMap;
    },
    enabled: !!codigo,
    staleTime: 1000 * 60 * 10, // 10 minutos de cache
  });
}
