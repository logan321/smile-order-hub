import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { extractColorsFromSvg } from '@/lib/uvCompositor';
import { Save, RefreshCcw, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface StampColorMappingManagerProps {
  stampId: string;
  svgUrl: string;
}

interface ColorCount {
  hex: string;
  region_name: string;
}

export default function StampColorMappingManager({ stampId, svgUrl }: StampColorMappingManagerProps) {
  const [colors, setColors] = useState<ColorCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchMappings = async () => {
    setLoading(true);
    try {
      const { data: existingMappings, error: fetchError } = await supabase
        .from('stamp_color_mappings')
        .select('*')
        .eq('stamp_id', stampId);

      if (fetchError) throw fetchError;

      const res = await fetch(svgUrl);
      const svgText = await res.text();
      const svgColors = extractColorsFromSvg(svgText);

      const colorCounts: ColorCount[] = svgColors.map(hex => {
        const existing = existingMappings?.find(m => m.original_color.toUpperCase() === hex.toUpperCase());
        return {
          hex,
          region_name: existing?.region_name || '',
        };
      });

      setColors(colorCounts);
    } catch (error: any) {
      toast.error('Erro ao carregar mapeamentos: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMappings();
  }, [stampId, svgUrl]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await supabase
        .from('stamp_color_mappings')
        .delete()
        .eq('stamp_id', stampId);

      const toInsert = colors
        .filter(c => c.region_name.trim() !== '')
        .map((c, index) => ({
          stamp_id: stampId,
          original_color: c.hex,
          region_name: c.region_name,
          sort_order: index,
        }));

      if (toInsert.length > 0) {
        const { error } = await supabase
          .from('stamp_color_mappings')
          .insert(toInsert);
        if (error) throw error;
      }

      toast.success('Mapeamento da estampa salvo!');
    } catch (error: any) {
      toast.error('Erro ao salvar: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const updateRegionName = (hex: string, name: string) => {
    setColors(prev => prev.map(c => c.hex === hex ? { ...c, region_name: name } : c));
  };

  if (loading) return <div className="flex items-center gap-2 text-muted-foreground py-4"><Loader2 className="h-4 w-4 animate-spin" /> Escaneando cores da estampa...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Mapeamento de Cores da Estampa</h3>
        <Button size="sm" variant="outline" onClick={fetchMappings} disabled={loading} className="h-8">
          <RefreshCcw className="h-3 w-3 mr-2" />
          Recarregar
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
          {colors.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">Nenhuma cor detectada no UV da estampa.</p>
          ) : (
            colors.map((color) => (
              <div key={color.hex} className="flex items-center gap-3 p-2 rounded-lg border border-border/50 bg-[#1a1d2e]">
                <div 
                  className="w-7 h-7 rounded border border-white/10 shrink-0" 
                  style={{ backgroundColor: color.hex }}
                />
                <div className="flex-1 min-w-0">
                  <Input 
                    placeholder="Ex: Detalhe Manga, Logo Peixe" 
                    className="h-7 text-[10px] bg-[#0f1117] border-border/50"
                    value={color.region_name}
                    onChange={(e) => updateRegionName(color.hex, e.target.value)}
                  />
                </div>
              </div>
            ))
          )}
        </div>

        <div className="bg-[#0f1117] rounded-xl border border-border/50 p-4 flex flex-col items-center justify-center">
            <p className="text-[10px] text-muted-foreground mb-2 font-bold uppercase">Preview UV Estampa</p>
            <img src={svgUrl} alt="UV Preview" className="max-w-full max-h-[300px] object-contain" />
        </div>
      </div>

      <Button onClick={handleSave} disabled={saving} size="sm" className="w-full bg-[#534AB7] hover:bg-[#534AB7]/90 mt-2">
        {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
        Salvar Mapeamento da Estampa
      </Button>
    </div>
  );
}
