import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface ShirtTemplate {
  id: string;
  name: string;
  frontImageUrl: string;
  backImageUrl: string;
  uvMapUrl: string | null;
  uvMapId: string | null;
  active: boolean;
  isDefault?: boolean;
  createdAt: string;
}

const isLikelyStampTemplateRow = (t: Record<string, string | null | undefined>) => {
  const front = t.front_image_url || '';
  const back = t.back_image_url || '';
  const name = (t.name || '').trim();

  // 1. Identical front/back usually means it's a UV map reference or placeholder
  if (front && back && front === back) return true;
  
  // 2. Specifically filter out uv-library paths
  if (/uv-library|uv-map/i.test(front) || /uv-library|uv-map/i.test(back)) return true;

  // 3. Original logic: name looks like a code AND it's a colorway/stamp
  const nameLooksLikeCode = /^[A-Za-z]{0,6}[-_.]?\d{1,6}[A-Za-z]{0,3}$/i.test(name);
  return nameLooksLikeCode && /colorway|estampa|stamp/i.test(`${front} ${back}`);
};

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
    setTemplates((data as any[])?.filter(t => !isLikelyStampTemplateRow(t)).map(t => ({
      id: t.id,
      name: t.name,
      frontImageUrl: t.front_image_url,
      backImageUrl: t.back_image_url,
      uvMapUrl: t.uv_map_url ?? null,
      uvMapId: t.uv_map_id ?? null,
      active: t.active,
      isDefault: t.is_default,
      createdAt: t.created_at,
    })) ?? []);
    setLoading(false);
  }, [targetUserId]);

  useEffect(() => { fetchTemplates(); }, [fetchTemplates]);

  const addTemplate = useCallback(async (name: string, frontFile: File | null, backFile: File | null, uvFile?: File | null, nicheId?: string | null, uvMapId?: string | null, fallbackUrl?: string | null) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const userId = targetUserId || session.user.id;
    const ts = Date.now();

    let frontUrlStr: string | null = fallbackUrl ?? null;
    if (frontFile) {
      const frontPath = `${userId}/${ts}_front_${frontFile.name}`;
      const { error: frontErr } = await supabase.storage.from('shirt-templates').upload(frontPath, frontFile);
      if (frontErr) throw frontErr;
      frontUrlStr = supabase.storage.from('shirt-templates').getPublicUrl(frontPath).data.publicUrl;
    }

    let backUrlStr: string | null = fallbackUrl ?? null;
    if (backFile) {
      const backPath = `${userId}/${ts}_back_${backFile.name}`;
      const { error: backErr } = await supabase.storage.from('shirt-templates').upload(backPath, backFile);
      if (backErr) throw backErr;
      backUrlStr = supabase.storage.from('shirt-templates').getPublicUrl(backPath).data.publicUrl;
    }

    let uvUrl: string | null = null;
    if (uvFile) {
      const uvPath = `${userId}/${ts}_uv_${uvFile.name}`;
      const { error: uvErr } = await supabase.storage.from('shirt-templates').upload(uvPath, uvFile);
      if (uvErr) throw uvErr;
      uvUrl = supabase.storage.from('shirt-templates').getPublicUrl(uvPath).data.publicUrl;
    }

    if (!frontUrlStr) frontUrlStr = backUrlStr ?? '';
    if (!backUrlStr) backUrlStr = frontUrlStr;

    await supabase.from('shirt_templates').insert({
      user_id: userId,
      name,
      front_image_url: frontUrlStr,
      back_image_url: backUrlStr,
      uv_map_url: uvUrl,
      uv_map_id: uvMapId ?? null,
      niche_id: nicheId ?? null,
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
  }, [fetchTemplates, targetUserId]);

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

  const updateTemplateUvMapId = useCallback(async (id: string, uvMapId: string | null) => {
    await supabase.from('shirt_templates').update({ uv_map_id: uvMapId } as any).eq('id', id);
    await fetchTemplates();
  }, [fetchTemplates]);

  const toggleDefault = useCallback(async (id: string, isDefault: boolean) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const userId = targetUserId || session.user.id;
    
    if (isDefault) {
      // Desmarca todos os outros templates como padrão para este usuário
      await supabase.from('shirt_templates').update({ is_default: false } as any).eq('user_id', userId);
    }
    
    await supabase.from('shirt_templates').update({ is_default: isDefault } as any).eq('id', id);
    await fetchTemplates();
  }, [fetchTemplates, targetUserId]);

  return { templates, loading, addTemplate, deleteTemplate, toggleActive, updateUvMap, updateTemplateUvMapId, toggleDefault, fetchTemplates };
}
