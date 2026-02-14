import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface OrderStage {
  id: string;
  name: string;
  position: number;
}

const DEFAULT_STAGES: Omit<OrderStage, 'id'>[] = [
  { name: 'Recebido', position: 0 },
  { name: 'Em Produção', position: 1 },
  { name: 'Pronto', position: 2 },
  { name: 'Entregue', position: 3 },
];

export function useOrderStages() {
  const [stages, setStages] = useState<OrderStage[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchStages = useCallback(async () => {
    const { data } = await supabase
      .from('order_stages')
      .select('*')
      .order('position', { ascending: true });
    setStages((data as any[])?.map(s => ({ id: s.id, name: s.name, position: s.position })) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchStages(); }, [fetchStages]);

  const addStage = useCallback(async (name: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const position = stages.length;
    await supabase.from('order_stages').insert({
      user_id: session.user.id, name, position,
    });
    await fetchStages();
  }, [stages, fetchStages]);

  const updateStage = useCallback(async (id: string, name: string) => {
    await supabase.from('order_stages').update({ name }).eq('id', id);
    await fetchStages();
  }, [fetchStages]);

  const deleteStage = useCallback(async (id: string) => {
    await supabase.from('order_stages').delete().eq('id', id);
    await fetchStages();
  }, [fetchStages]);

  const reorderStages = useCallback(async (reordered: OrderStage[]) => {
    setStages(reordered);
    for (let i = 0; i < reordered.length; i++) {
      await supabase.from('order_stages').update({ position: i }).eq('id', reordered[i].id);
    }
  }, []);

  const initDefaults = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    for (const stage of DEFAULT_STAGES) {
      await supabase.from('order_stages').insert({
        user_id: session.user.id, name: stage.name, position: stage.position,
      });
    }
    await fetchStages();
  }, [fetchStages]);

  return { stages, loading, addStage, updateStage, deleteStage, reorderStages, initDefaults };
}
