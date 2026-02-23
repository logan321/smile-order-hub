import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface TextStyle {
  id: string;
  name: string;
  category: string;
  imageUrl: string;
  active: boolean;
}

export function useTextStyles(userId?: string) {
  const [styles, setStyles] = useState<TextStyle[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchStyles = async () => {
    if (!userId) return;
    const { data, error } = await supabase
      .from('text_styles')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) { console.error(error); return; }
    setStyles((data || []).map(s => ({
      id: s.id,
      name: s.name,
      category: s.category,
      imageUrl: s.image_url,
      active: s.active,
    })));
    setLoading(false);
  };

  useEffect(() => { fetchStyles(); }, [userId]);

  const addStyle = async (name: string, category: string, file: File) => {
    if (!userId) return;
    const ext = file.name.split('.').pop() || 'png';
    const path = `${userId}/${Date.now()}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from('text-styles')
      .upload(path, file, { contentType: file.type });
    if (uploadError) { toast.error('Erro no upload'); return; }
    const { data: urlData } = supabase.storage.from('text-styles').getPublicUrl(path);
    const { error } = await supabase.from('text_styles').insert({
      user_id: userId, name, category, image_url: urlData.publicUrl,
    });
    if (error) { toast.error('Erro ao salvar'); return; }
    toast.success('Estilo adicionado!');
    fetchStyles();
  };

  const addMultipleStyles = async (category: string, files: File[]) => {
    if (!userId || files.length === 0) return;
    let success = 0;
    for (const file of files) {
      const nameWithoutExt = file.name.replace(/\.[^/.]+$/, '');
      const ext = file.name.split('.').pop() || 'png';
      const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('text-styles')
        .upload(path, file, { contentType: file.type });
      if (uploadError) { console.error(uploadError); continue; }
      const { data: urlData } = supabase.storage.from('text-styles').getPublicUrl(path);
      const { error } = await supabase.from('text_styles').insert({
        user_id: userId, name: nameWithoutExt, category, image_url: urlData.publicUrl,
      });
      if (!error) success++;
    }
    if (success > 0) {
      toast.success(`${success} estilo(s) adicionado(s)!`);
      fetchStyles();
    } else {
      toast.error('Erro ao enviar estilos');
    }
  };

  const deleteStyle = async (id: string) => {
    const style = styles.find(s => s.id === id);
    if (style) {
      try {
        const url = new URL(style.imageUrl);
        const pathParts = url.pathname.split('/text-styles/');
        if (pathParts[1]) {
          await supabase.storage.from('text-styles').remove([decodeURIComponent(pathParts[1])]);
        }
      } catch {}
    }
    await supabase.from('text_styles').delete().eq('id', id);
    toast.success('Estilo removido');
    fetchStyles();
  };

  const toggleActive = async (id: string, active: boolean) => {
    await supabase.from('text_styles').update({ active: !active }).eq('id', id);
    fetchStyles();
  };

  return { styles, loading, addStyle, addMultipleStyles, deleteStyle, toggleActive };
}
