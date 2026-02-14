import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface ShirtTemplate {
  id: string;
  name: string;
  frontImageUrl: string;
  backImageUrl: string;
  active: boolean;
  createdAt: string;
}

export function useShirtTemplates() {
  const [templates, setTemplates] = useState<ShirtTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTemplates = useCallback(async () => {
    const { data } = await supabase
      .from('shirt_templates')
      .select('*')
      .order('created_at', { ascending: false });
    setTemplates((data as any[])?.map(t => ({
      id: t.id,
      name: t.name,
      frontImageUrl: t.front_image_url,
      backImageUrl: t.back_image_url,
      active: t.active,
      createdAt: t.created_at,
    })) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchTemplates(); }, [fetchTemplates]);

  const addTemplate = useCallback(async (name: string, frontFile: File, backFile: File) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const userId = session.user.id;
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

    await supabase.from('shirt_templates').insert({
      user_id: userId,
      name,
      front_image_url: frontUrl.publicUrl,
      back_image_url: backUrl.publicUrl,
    });

    await fetchTemplates();
  }, [fetchTemplates]);

  const deleteTemplate = useCallback(async (id: string) => {
    await supabase.from('shirt_templates').delete().eq('id', id);
    await fetchTemplates();
  }, [fetchTemplates]);

  const toggleActive = useCallback(async (id: string, active: boolean) => {
    await supabase.from('shirt_templates').update({ active }).eq('id', id);
    await fetchTemplates();
  }, [fetchTemplates]);

  return { templates, loading, addTemplate, deleteTemplate, toggleActive };
}
