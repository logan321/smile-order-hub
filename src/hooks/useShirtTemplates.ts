import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface ShirtTemplate {
  id: string;
  name: string;
  frontImageUrl: string;
  backImageUrl: string;
  uvMapUrl: string | null;
  active: boolean;
  createdAt: string;
}

export function useShirtTemplates(targetUserId?: string) {
  const [templates, setTemplates] = useState<ShirtTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTemplates = useCallback(async () => {
    let userId = targetUserId;
    if (!userId) {
      const { data: { session } } = await supabase.auth.getSession();
      userId = session?.user?.id;
    }
    let query = supabase.from('shirt_templates').select('*').order('created_at', { ascending: false });
    if (userId) query = query.eq('user_id', userId);
    const { data } = await query;
    setTemplates((data as any[])?.map(t => ({
      id: t.id,
      name: t.name,
      frontImageUrl: t.front_image_url,
      backImageUrl: t.back_image_url,
      uvMapUrl: t.uv_map_url ?? null,
      active: t.active,
      createdAt: t.created_at,
    })) ?? []);
    setLoading(false);
  }, [targetUserId]);

  useEffect(() => { fetchTemplates(); }, [fetchTemplates]);

  const addTemplate = useCallback(async (name: string, frontFile: File, backFile: File, uvFile?: File | null) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const userId = targetUserId || session.user.id;
    const ts = Date.now();

    // Upload front
    const frontPath = `${userId}/${ts}_front_${frontFile.name}`;
    const { error: frontErr } = await supabase.storage.from('shirt-templates').upload(frontPath, frontFile);
    if (frontErr) throw frontErr;
    const { data: frontUrl } = supabase.storage.from('shirt-templates').getPublicUrl(frontPath);

    // Upload back
    const backPath = `${userId}/${ts}_back_${backFile.name}`;
    const { error: backErr } = await supabase.storage.from('shirt-templates').upload(backPath, backFile);
    if (backErr) throw backErr;
    const { data: backUrl } = supabase.storage.from('shirt-templates').getPublicUrl(backPath);

    let uvUrl: string | null = null;
    if (uvFile) {
      const uvPath = `${userId}/${ts}_uv_${uvFile.name}`;
      const { error: uvErr } = await supabase.storage.from('shirt-templates').upload(uvPath, uvFile);
      if (uvErr) throw uvErr;
      uvUrl = supabase.storage.from('shirt-templates').getPublicUrl(uvPath).data.publicUrl;
    }

    await supabase.from('shirt_templates').insert({
      user_id: userId,
      name,
      front_image_url: frontUrl.publicUrl,
      back_image_url: backUrl.publicUrl,
      uv_map_url: uvUrl,
    } as any);

    await fetchTemplates();
  }, [fetchTemplates, targetUserId]);

  const deleteTemplate = useCallback(async (id: string) => {
    // Remove dependent records first
    await supabase.from('shirt_designs').delete().eq('template_id', id);
    await supabase.from('template_zones').delete().eq('template_id', id);
    await supabase.from('shirt_templates').delete().eq('id', id);
    await fetchTemplates();
  }, [fetchTemplates, targetUserId]);

  const toggleActive = useCallback(async (id: string, active: boolean) => {
    await supabase.from('shirt_templates').update({ active }).eq('id', id);
    await fetchTemplates();
  }, [fetchTemplates]);

  const updateUvMap = useCallback(async (id: string, uvFile: File | null) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const userId = targetUserId || session.user.id;
    let uvUrl: string | null = null;
    if (uvFile) {
      const ts = Date.now();
      const uvPath = `${userId}/${ts}_uv_${uvFile.name}`;
      const { error } = await supabase.storage.from('shirt-templates').upload(uvPath, uvFile);
      if (error) throw error;
      uvUrl = supabase.storage.from('shirt-templates').getPublicUrl(uvPath).data.publicUrl;
    }
    await supabase.from('shirt_templates').update({ uv_map_url: uvUrl } as any).eq('id', id);
    await fetchTemplates();
  }, [fetchTemplates, targetUserId]);

  return { templates, loading, addTemplate, deleteTemplate, toggleActive, updateUvMap, fetchTemplates };
}
