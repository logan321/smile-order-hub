import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface UvMapItem {
  id: string;
  code: string;
  name: string | null;
  imageUrl: string;
  createdAt: string;
}

export function useUvLibrary(targetUserId?: string) {
  const [uvMaps, setUvMaps] = useState<UvMapItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchUvMaps = useCallback(async () => {
    let userId = targetUserId;
    if (!userId) {
      const { data: { session } } = await supabase.auth.getSession();
      userId = session?.user?.id;
    }
    if (!userId) { setUvMaps([]); setLoading(false); return; }
    const { data } = await supabase
      .from('uv_maps' as any)
      .select('*')
      .eq('user_id', userId)
      .order('code', { ascending: true });
    setUvMaps((data as any[])?.map(u => ({
      id: u.id,
      code: u.code,
      name: u.name ?? null,
      imageUrl: u.image_url,
      createdAt: u.created_at,
    })) ?? []);
    setLoading(false);
  }, [targetUserId]);

  useEffect(() => { fetchUvMaps(); }, [fetchUvMaps]);

  const addUvMap = useCallback(async (code: string, name: string | null, file: File) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('not authenticated');
    const userId = targetUserId || session.user.id;
    const ts = Date.now();
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `${userId}/uv-library/${ts}_${safeName}`;
    const { error: upErr } = await supabase.storage.from('stamp-catalog').upload(path, file);
    if (upErr) throw upErr;
    const imageUrl = supabase.storage.from('stamp-catalog').getPublicUrl(path).data.publicUrl;
    const { error } = await supabase.from('uv_maps' as any).insert({
      user_id: userId,
      code: code.trim(),
      name: name?.trim() || null,
      image_url: imageUrl,
    } as any);
    if (error) throw error;
    await fetchUvMaps();
  }, [fetchUvMaps, targetUserId]);

  const updateUvMap = useCallback(async (id: string, updates: { code?: string; name?: string | null; file?: File | null }) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('not authenticated');
    const userId = targetUserId || session.user.id;
    const patch: any = {};
    if (updates.code !== undefined) patch.code = updates.code.trim();
    if (updates.name !== undefined) patch.name = updates.name?.trim() || null;
    if (updates.file) {
      const ts = Date.now();
      const safeName = updates.file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const path = `${userId}/uv-library/${ts}_${safeName}`;
      const { error: upErr } = await supabase.storage.from('stamp-catalog').upload(path, updates.file);
      if (upErr) throw upErr;
      patch.image_url = supabase.storage.from('stamp-catalog').getPublicUrl(path).data.publicUrl;
    }
    const { error } = await supabase.from('uv_maps' as any).update(patch).eq('id', id);
    if (error) throw error;
    await fetchUvMaps();
  }, [fetchUvMaps, targetUserId]);

  const deleteUvMap = useCallback(async (id: string) => {
    const { error } = await supabase.from('uv_maps' as any).delete().eq('id', id);
    if (error) throw error;
    await fetchUvMaps();
  }, [fetchUvMaps]);

  return { uvMaps, loading, addUvMap, updateUvMap, deleteUvMap, fetchUvMaps };
}