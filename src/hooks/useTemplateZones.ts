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
  pathData: { x: number; y: number }[] | null;
  rotation: number;
  patchOnly: boolean;
  // Independent back-side positioning for shared zones
  backXPercent: number;
  backYPercent: number;
  backWidthPercent: number;
  backHeightPercent: number;
  backRotation: number;
  backPathData: { x: number; y: number }[] | null;
}

export function useTemplateZones(templateId?: string, uvMapId?: string) {
  const [zones, setZones] = useState<TemplateZone[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchZones = useCallback(async () => {
    if (!templateId && !uvMapId) { setZones([]); return; }
    setLoading(true);
    let query = supabase.from('template_zones').select('*').order('created_at', { ascending: true });
    if (uvMapId) {
      query = query.eq('uv_map_id', uvMapId);
    } else if (templateId) {
      query = query.eq('template_id', templateId);
    }
    const { data } = await query;

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
      patchOnly: Boolean(z.patch_only),
      pathData: z.path_data as { x: number; y: number }[] | null,
      rotation: Number(z.rotation ?? 0),
      backXPercent: Number(z.back_x_percent ?? z.x_percent),
      backYPercent: Number(z.back_y_percent ?? z.y_percent),
      backWidthPercent: Number(z.back_width_percent ?? z.width_percent),
      backHeightPercent: Number(z.back_height_percent ?? z.height_percent),
      backRotation: Number(z.back_rotation ?? z.rotation ?? 0),
      backPathData: z.back_path_data as { x: number; y: number }[] | null,
    })) ?? []);
    setLoading(false);
  }, [templateId, uvMapId]);

  useEffect(() => { fetchZones(); }, [fetchZones]);

  const addZone = useCallback(async (name: string, side: 'front' | 'back', x = 30, y = 30, w = 20, h = 15) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session || (!templateId && !uvMapId)) return;

    await supabase.from('template_zones').insert({
      template_id: uvMapId ? null : templateId,
      uv_map_id: uvMapId ?? null,
      user_id: session.user.id,
      name,
      side,
      x_percent: x,
      y_percent: y,
      width_percent: w,
      height_percent: h,
      back_x_percent: x,
      back_y_percent: y,
      back_width_percent: w,
      back_height_percent: h,
    });
    await fetchZones();
  }, [templateId, uvMapId, fetchZones]);

  const updateZone = useCallback(async (id: string, updates: Partial<Pick<TemplateZone, 'name' | 'xPercent' | 'yPercent' | 'widthPercent' | 'heightPercent' | 'shared' | 'patchOnly' | 'pathData' | 'rotation' | 'backXPercent' | 'backYPercent' | 'backWidthPercent' | 'backHeightPercent' | 'backRotation' | 'backPathData'>>) => {
    const mapped: Record<string, any> = {};
    if (updates.name !== undefined) mapped.name = updates.name;
    if (updates.xPercent !== undefined) mapped.x_percent = updates.xPercent;
    if (updates.yPercent !== undefined) mapped.y_percent = updates.yPercent;
    if (updates.widthPercent !== undefined) mapped.width_percent = updates.widthPercent;
    if (updates.heightPercent !== undefined) mapped.height_percent = updates.heightPercent;
    if (updates.shared !== undefined) mapped.shared = updates.shared;
    if (updates.patchOnly !== undefined) mapped.patch_only = updates.patchOnly;
    if (updates.pathData !== undefined) mapped.path_data = updates.pathData;
    if (updates.rotation !== undefined) mapped.rotation = updates.rotation;
    if (updates.backXPercent !== undefined) mapped.back_x_percent = updates.backXPercent;
    if (updates.backYPercent !== undefined) mapped.back_y_percent = updates.backYPercent;
    if (updates.backWidthPercent !== undefined) mapped.back_width_percent = updates.backWidthPercent;
    if (updates.backHeightPercent !== undefined) mapped.back_height_percent = updates.backHeightPercent;
    if (updates.backRotation !== undefined) mapped.back_rotation = updates.backRotation;
    if (updates.backPathData !== undefined) mapped.back_path_data = updates.backPathData;

    // When enabling shared, initialize back positions from front if not set
    if (updates.shared === true) {
      const zone = (await supabase.from('template_zones').select('*').eq('id', id).single()).data as any;
      if (zone && (zone.back_x_percent === 0 && zone.back_y_percent === 0 && zone.back_width_percent === 20 && zone.back_height_percent === 20)) {
        mapped.back_x_percent = zone.x_percent;
        mapped.back_y_percent = zone.y_percent;
        mapped.back_width_percent = zone.width_percent;
        mapped.back_height_percent = zone.height_percent;
        mapped.back_rotation = zone.rotation;
        mapped.back_path_data = zone.path_data;
      }
    }

    await supabase.from('template_zones').update(mapped).eq('id', id);
    await fetchZones();
  }, [fetchZones]);

  const deleteZone = useCallback(async (id: string) => {
    await supabase.from('template_zones').delete().eq('id', id);
    await fetchZones();
  }, [fetchZones]);

  return { zones, loading, addZone, updateZone, deleteZone, refetch: fetchZones };
}
