import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface TemplateZone {
  id: string;
  templateId: string;
  name: string;
  side: 'front' | 'back';
  xPercent: number;
  yPercent: number;
  widthPercent: number;
  heightPercent: number;
  shared: boolean;
}

export function useTemplateZones(templateId?: string) {
  const [zones, setZones] = useState<TemplateZone[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchZones = useCallback(async () => {
    if (!templateId) { setZones([]); return; }
    setLoading(true);
    const { data } = await supabase
      .from('template_zones')
      .select('*')
      .eq('template_id', templateId)
      .order('created_at', { ascending: true });

    setZones((data as any[])?.map(z => ({
      id: z.id,
      templateId: z.template_id,
      name: z.name,
      side: z.side as 'front' | 'back',
      xPercent: Number(z.x_percent),
      yPercent: Number(z.y_percent),
      widthPercent: Number(z.width_percent),
      heightPercent: Number(z.height_percent),
      shared: Boolean(z.shared),
    })) ?? []);
    setLoading(false);
  }, [templateId]);

  useEffect(() => { fetchZones(); }, [fetchZones]);

  const addZone = useCallback(async (name: string, side: 'front' | 'back', x = 30, y = 30, w = 20, h = 15) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session || !templateId) return;

    await supabase.from('template_zones').insert({
      template_id: templateId,
      user_id: session.user.id,
      name,
      side,
      x_percent: x,
      y_percent: y,
      width_percent: w,
      height_percent: h,
    });
    await fetchZones();
  }, [templateId, fetchZones]);

  const updateZone = useCallback(async (id: string, updates: Partial<Pick<TemplateZone, 'name' | 'xPercent' | 'yPercent' | 'widthPercent' | 'heightPercent' | 'shared'>>) => {
    const mapped: Record<string, any> = {};
    if (updates.name !== undefined) mapped.name = updates.name;
    if (updates.xPercent !== undefined) mapped.x_percent = updates.xPercent;
    if (updates.yPercent !== undefined) mapped.y_percent = updates.yPercent;
    if (updates.widthPercent !== undefined) mapped.width_percent = updates.widthPercent;
    if (updates.heightPercent !== undefined) mapped.height_percent = updates.heightPercent;
    if (updates.shared !== undefined) mapped.shared = updates.shared;

    await supabase.from('template_zones').update(mapped).eq('id', id);
    await fetchZones();
  }, [fetchZones]);

  const deleteZone = useCallback(async (id: string) => {
    await supabase.from('template_zones').delete().eq('id', id);
    await fetchZones();
  }, [fetchZones]);

  return { zones, loading, addZone, updateZone, deleteZone, refetch: fetchZones };
}
