import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface Niche {
  id: string;
  name: string;
  icon: string;
  patchLabel: string;
  coverImageUrl: string;
  position: number;
  createdAt: string;
}

export function useNiches(targetUserId?: string) {
  const [niches, setNiches] = useState<Niche[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNiches = useCallback(async () => {
    let userId = targetUserId;
    if (!userId) {
      const { data: { session } } = await supabase.auth.getSession();
      userId = session?.user?.id;
    }
    let query = supabase.from('niches').select('*').order('position', { ascending: true });
    if (userId) query = query.eq('user_id', userId);
    const { data } = await query;
    setNiches((data as any[])?.map(n => ({
      id: n.id,
      name: n.name,
      icon: n.icon,
      patchLabel: n.patch_label,
      coverImageUrl: n.cover_image_url || '',
      position: n.position,
      createdAt: n.created_at,
    })) ?? []);
    setLoading(false);
  }, [targetUserId]);

  useEffect(() => { fetchNiches(); }, [fetchNiches]);

  const addNiche = useCallback(async (name: string, icon: string, patchLabel: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const userId = targetUserId || session.user.id;
    const maxPos = niches.length > 0 ? Math.max(...niches.map(n => n.position)) + 1 : 0;
    await supabase.from('niches').insert({
      user_id: userId,
      name,
      icon,
      patch_label: patchLabel,
      position: maxPos,
    } as any);
    await fetchNiches();
  }, [fetchNiches, niches, targetUserId]);

  const updateNiche = useCallback(async (id: string, updates: { name?: string; icon?: string; patchLabel?: string; coverImageUrl?: string }) => {
    const payload: any = {};
    if (updates.name !== undefined) payload.name = updates.name;
    if (updates.icon !== undefined) payload.icon = updates.icon;
    if (updates.patchLabel !== undefined) payload.patch_label = updates.patchLabel;
    if (updates.coverImageUrl !== undefined) payload.cover_image_url = updates.coverImageUrl;
    await supabase.from('niches').update(payload).eq('id', id);
    await fetchNiches();
  }, [fetchNiches]);

  const deleteNiche = useCallback(async (id: string) => {
    await supabase.from('niches').delete().eq('id', id);
    await fetchNiches();
  }, [fetchNiches]);

  const uploadCoverImage = useCallback(async (nicheId: string, file: File) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const userId = targetUserId || session.user.id;
    const ext = file.name.split('.').pop();
    const path = `${userId}/niche-covers/${nicheId}-${Date.now()}.${ext}`;
    const { error: uploadError } = await supabase.storage.from('shirt-templates').upload(path, file, { upsert: true });
    if (uploadError) throw uploadError;
    const { data: urlData } = supabase.storage.from('shirt-templates').getPublicUrl(path);
    await supabase.from('niches').update({ cover_image_url: urlData.publicUrl } as any).eq('id', nicheId);
    await fetchNiches();
    return urlData.publicUrl;
  }, [fetchNiches, targetUserId]);

  return { niches, loading, addNiche, updateNiche, deleteNiche, uploadCoverImage, refetch: fetchNiches };
}
