import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface StampColor {
  id: string;
  stampId: string;
  colorName: string;
  colorHex: string;
  imageUrl: string;
  backImageUrl: string | null;
  position: number;
}

export function useStampColors(stampId?: string, targetUserId?: string) {
  const [colors, setColors] = useState<StampColor[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchColors = useCallback(async () => {
    if (!stampId) { setColors([]); return; }
    setLoading(true);
    const { data } = await supabase
      .from('stamp_colors')
      .select('*')
      .eq('stamp_id', stampId)
      .order('position', { ascending: true });
    setColors((data as any[])?.map(c => ({
      id: c.id,
      stampId: c.stamp_id,
      colorName: c.color_name,
      colorHex: c.color_hex,
      imageUrl: c.image_url,
      backImageUrl: c.back_image_url ?? null,
      position: c.position,
    })) ?? []);
    setLoading(false);
  }, [stampId]);

  useEffect(() => { fetchColors(); }, [fetchColors]);

  const addColor = useCallback(async (colorName: string, colorHex: string, frontFile: File, backFile?: File) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session || !stampId) return;
    const userId = targetUserId || session.user.id;
    const ts = Date.now();

    const frontPath = `${userId}/${ts}_color_front_${frontFile.name}`;
    const { error: fe } = await supabase.storage.from('stamp-catalog').upload(frontPath, frontFile);
    if (fe) throw fe;
    const { data: frontUrl } = supabase.storage.from('stamp-catalog').getPublicUrl(frontPath);

    let backUrl: string | null = null;
    if (backFile) {
      const backPath = `${userId}/${ts}_color_back_${backFile.name}`;
      const { error: be } = await supabase.storage.from('stamp-catalog').upload(backPath, backFile);
      if (be) throw be;
      const { data: bu } = supabase.storage.from('stamp-catalog').getPublicUrl(backPath);
      backUrl = bu.publicUrl;
    }

    await supabase.from('stamp_colors').insert({
      stamp_id: stampId,
      user_id: userId,
      color_name: colorName,
      color_hex: colorHex,
      image_url: frontUrl.publicUrl,
      back_image_url: backUrl,
      position: colors.length,
    } as any);

    await fetchColors();
  }, [stampId, targetUserId, fetchColors, colors.length]);

  const deleteColor = useCallback(async (id: string) => {
    await supabase.from('stamp_colors').delete().eq('id', id);
    await fetchColors();
  }, [fetchColors]);

  return { colors, loading, addColor, deleteColor, refetch: fetchColors };
}

// Fetch all colors for multiple stamps at once (for the editor)
export async function fetchAllStampColors(ownerUserId: string): Promise<StampColor[]> {
  const { data } = await supabase
    .from('stamp_colors')
    .select('*')
    .eq('user_id', ownerUserId)
    .order('position', { ascending: true });
  return (data as any[])?.map(c => ({
    id: c.id,
    stampId: c.stamp_id,
    colorName: c.color_name,
    colorHex: c.color_hex,
    imageUrl: c.image_url,
    backImageUrl: c.back_image_url ?? null,
    position: c.position,
  })) ?? [];
}
