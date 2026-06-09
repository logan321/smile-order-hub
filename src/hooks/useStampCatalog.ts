import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface StampItem {
  id: string;
  name: string;
  category: string;
  imageUrl: string;
  miniaturaFrenteUrl: string | null;
  codigo: string | null;
  backImageUrl: string | null;
  uvMapUrl: string | null;
  uvMapId: string | null;
  templateId: string | null;
  nicheId: string | null;
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
      uvMapUrl: s.uv_map_url ?? null,
      uvMapId: s.uv_map_id ?? null,
      templateId: s.template_id ?? null,
      nicheId: s.niche_id ?? null,
      active: s.active,
      createdAt: s.created_at,
    })) ?? []);
    setLoading(false);
  }, [targetUserId]);

  useEffect(() => { fetchStamps(); }, [fetchStamps]);

  const addStamp = useCallback(async (name: string, category: string, frontFile: File, backFile: File, uvFile?: File | null, nicheId?: string | null, uvMapId?: string | null, templateId?: string | null) => {
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

    let uvUrl: string | null = null;
    if (uvFile) {
      const uvPath = `${userId}/${ts}_uv_${uvFile.name}`;
      const { error: uvErr } = await supabase.storage.from('stamp-catalog').upload(uvPath, uvFile);
      if (uvErr) throw uvErr;
      uvUrl = supabase.storage.from('stamp-catalog').getPublicUrl(uvPath).data.publicUrl;
    }

    await supabase.from('stamp_catalog').insert({
      user_id: userId,
      name,
      category,
      image_url: frontUrl.publicUrl,
      back_image_url: backUrl.publicUrl,
      uv_map_url: uvUrl,
      uv_map_id: uvMapId ?? null,
      template_id: templateId ?? null,
      niche_id: nicheId || null,
    } as any);

    await fetchStamps();
  }, [fetchStamps, targetUserId]);

  const deleteStamp = useCallback(async (id: string) => {
    await supabase.from('stamp_catalog').delete().eq('id', id);
    await fetchStamps();
  }, [fetchStamps, targetUserId]);

  const updateStampUv = useCallback(async (id: string, uvFile: File | null) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const userId = targetUserId || session.user.id;
    let uvUrl: string | null = null;
    if (uvFile) {
      const ts = Date.now();
      const uvPath = `${userId}/${ts}_uv_${uvFile.name}`;
      const { error } = await supabase.storage.from('stamp-catalog').upload(uvPath, uvFile);
      if (error) throw error;
      uvUrl = supabase.storage.from('stamp-catalog').getPublicUrl(uvPath).data.publicUrl;
    }
    await supabase.from('stamp_catalog').update({ uv_map_url: uvUrl } as any).eq('id', id);
    await fetchStamps();
  }, [fetchStamps, targetUserId]);

  const updateStampUvMapId = useCallback(async (id: string, uvMapId: string | null) => {
    await supabase.from('stamp_catalog').update({ uv_map_id: uvMapId } as any).eq('id', id);
    await fetchStamps();
  }, [fetchStamps]);

  const updateStampTemplateId = useCallback(async (id: string, templateId: string | null) => {
    await supabase.from('stamp_catalog').update({ template_id: templateId } as any).eq('id', id);
    await fetchStamps();
  }, [fetchStamps]);

  return { stamps, loading, addStamp, deleteStamp, updateStampUv, updateStampUvMapId, updateStampTemplateId, fetchStamps };
}
