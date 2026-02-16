import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface StampItem {
  id: string;
  name: string;
  category: string;
  imageUrl: string;
  backImageUrl: string | null;
  active: boolean;
  createdAt: string;
}

export function useStampCatalog(targetUserId?: string) {
  const [stamps, setStamps] = useState<StampItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchStamps = useCallback(async () => {
    let userId = targetUserId;
    if (!userId) {
      const { data: { session } } = await supabase.auth.getSession();
      userId = session?.user?.id;
    }
    let query = supabase.from('stamp_catalog').select('*').order('created_at', { ascending: false });
    if (userId) query = query.eq('user_id', userId);
    const { data } = await query;
    setStamps((data as any[])?.map(s => ({
      id: s.id,
      name: s.name,
      category: s.category,
      imageUrl: s.image_url,
      backImageUrl: s.back_image_url ?? null,
      active: s.active,
      createdAt: s.created_at,
    })) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchStamps(); }, [fetchStamps]);

  const addStamp = useCallback(async (name: string, category: string, frontFile: File, backFile: File) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const userId = targetUserId || session.user.id;
    const ts = Date.now();

    // Upload front
    const frontPath = `${userId}/${ts}_front_${frontFile.name}`;
    const { error: frontErr } = await supabase.storage.from('stamp-catalog').upload(frontPath, frontFile);
    if (frontErr) throw frontErr;
    const { data: frontUrl } = supabase.storage.from('stamp-catalog').getPublicUrl(frontPath);

    // Upload back
    const backPath = `${userId}/${ts}_back_${backFile.name}`;
    const { error: backErr } = await supabase.storage.from('stamp-catalog').upload(backPath, backFile);
    if (backErr) throw backErr;
    const { data: backUrl } = supabase.storage.from('stamp-catalog').getPublicUrl(backPath);

    await supabase.from('stamp_catalog').insert({
      user_id: userId,
      name,
      category,
      image_url: frontUrl.publicUrl,
      back_image_url: backUrl.publicUrl,
    } as any);

    await fetchStamps();
  }, [fetchStamps]);

  const deleteStamp = useCallback(async (id: string) => {
    await supabase.from('stamp_catalog').delete().eq('id', id);
    await fetchStamps();
  }, [fetchStamps]);

  return { stamps, loading, addStamp, deleteStamp };
}
