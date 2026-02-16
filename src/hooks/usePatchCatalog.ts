import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface PatchItem {
  id: string;
  name: string;
  imageUrl: string;
  targetZoneName: string;
  active: boolean;
  createdAt: string;
}

export function usePatchCatalog(targetUserId?: string) {
  const [patches, setPatches] = useState<PatchItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPatches = useCallback(async () => {
    let userId = targetUserId;
    if (!userId) {
      const { data: { session } } = await supabase.auth.getSession();
      userId = session?.user?.id;
    }
    let query = supabase.from('patch_catalog').select('*').order('created_at', { ascending: false });
    if (userId) query = query.eq('user_id', userId);
    const { data } = await query;
    setPatches((data as any[])?.map(p => ({
      id: p.id,
      name: p.name,
      imageUrl: p.image_url,
      targetZoneName: p.target_zone_name,
      active: p.active,
      createdAt: p.created_at,
    })) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchPatches(); }, [fetchPatches]);

  const addPatch = useCallback(async (name: string, file: File) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const userId = targetUserId || session.user.id;
    const ts = Date.now();
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `${userId}/${ts}_${safeName}`;

    const { error: uploadErr } = await supabase.storage.from('patch-catalog').upload(path, file);
    if (uploadErr) throw uploadErr;

    const { data: urlData } = supabase.storage.from('patch-catalog').getPublicUrl(path);

    await supabase.from('patch_catalog').insert({
      user_id: userId,
      name,
      image_url: urlData.publicUrl,
    } as any);

    await fetchPatches();
  }, [fetchPatches]);

  const deletePatch = useCallback(async (id: string) => {
    await supabase.from('patch_catalog').delete().eq('id', id);
    await fetchPatches();
  }, [fetchPatches]);

  return { patches, loading, addPatch, deletePatch };
}
