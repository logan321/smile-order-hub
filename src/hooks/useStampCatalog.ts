import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface StampItem {
  id: string;
  name: string;
  category: string;
  imageUrl: string;
  active: boolean;
  createdAt: string;
}

export function useStampCatalog() {
  const [stamps, setStamps] = useState<StampItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchStamps = useCallback(async () => {
    const { data } = await supabase
      .from('stamp_catalog')
      .select('*')
      .order('created_at', { ascending: false });
    setStamps((data as any[])?.map(s => ({
      id: s.id,
      name: s.name,
      category: s.category,
      imageUrl: s.image_url,
      active: s.active,
      createdAt: s.created_at,
    })) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchStamps(); }, [fetchStamps]);

  const addStamp = useCallback(async (name: string, category: string, file: File) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const userId = session.user.id;
    const filePath = `${userId}/${Date.now()}_${file.name}`;
    const { error: uploadErr } = await supabase.storage.from('stamp-catalog').upload(filePath, file);
    if (uploadErr) throw uploadErr;
    const { data: urlData } = supabase.storage.from('stamp-catalog').getPublicUrl(filePath);

    await supabase.from('stamp_catalog').insert({
      user_id: userId,
      name,
      category,
      image_url: urlData.publicUrl,
    });

    await fetchStamps();
  }, [fetchStamps]);

  const deleteStamp = useCallback(async (id: string) => {
    await supabase.from('stamp_catalog').delete().eq('id', id);
    await fetchStamps();
  }, [fetchStamps]);

  return { stamps, loading, addStamp, deleteStamp };
}
