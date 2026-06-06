import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { extractColorsFromSvg } from '@/lib/uvCompositor';
import { Save, RefreshCcw, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface TemplateColorMappingManagerProps {
  templateId: string;
  svgUrl: string;
}

interface ColorCount {
  hex: string;
  count: number;
  region_name: string;
}

export default function TemplateColorMappingManager({ templateId, svgUrl }: TemplateColorMappingManagerProps) {
  const [colors, setColors] = useState<ColorCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchMappings = async () => {
    setLoading(true);
    try {
      // 1. Fetch existing mappings
      const { data: existingMappings, error: fetchError } = await supabase
        .from('template_color_mappings')
        .select('*')
        .eq('template_id', templateId);

      if (fetchError) throw fetchError;

      // 2. Fetch SVG and extract colors
      const res = await fetch(svgUrl);
      const svgText = await res.text();
      const svgColors = extractColorsFromSvg(svgText);

      // 3. Merge
      const colorCounts: ColorCount[] = svgColors.map(hex => {
        const existing = existingMappings?.find(m => m.original_color.toUpperCase() === hex.toUpperCase());
        return {
          hex,
          count: 0, // In a real implementation we could count occurrences in SVG
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
  }, [templateId, svgUrl]);

  const handleSave = async () => {
    setSaving(true);
    try {
      // Simple strategy: delete existing and insert new ones
      await supabase
        .from('template_color_mappings')
        .delete()
        .eq('template_id', templateId);

      const toInsert = colors
        .filter(c => c.region_name.trim() !== '')
        .map((c, index) => ({
          template_id: templateId,
          original_color: c.hex,
          region_name: c.region_name,
          sort_order: index,
        }));

      if (toInsert.length > 0) {
        const { error } = await supabase
          .from('template_color_mappings')
          .insert(toInsert);
        if (error) throw error;
      }

      toast.success('Mapeamento salvo com sucesso!');
    } catch (error: any) {
      toast.error('Erro ao salvar: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const updateRegionName = (hex: string, name: string) => {
    setColors(prev => prev.map(c => c.hex === hex ? { ...c, region_name: name } : c));
  };

  if (loading) return <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Carregando cores do SVG...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Mapeamento de Cores do SVG</h3>
        <Button size="sm" variant="outline" onClick={fetchMappings} disabled={loading}>
          <RefreshCcw className="h-3.5 w-3.5 mr-2" />
          Recarregar
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-3">
          {colors.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">Nenhuma cor detectada no SVG.</p>
          ) : (
            colors.map((color) => (
              <div key={color.hex} className="flex items-center gap-3 p-3 rounded-lg border border-border/50 bg-[#1a1d2e]">
                <div 
                  className="w-8 h-8 rounded border border-white/10 shadow-sm shrink-0" 
                  style={{ backgroundColor: color.hex }}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] text-muted-foreground font-mono uppercase">{color.hex}</p>
                  <Input 
                    placeholder="Nome da região (ex: corpo, gola)" 
                    className="h-8 text-xs bg-[#0f1117] border-border/50 mt-1"
                    value={color.region_name}
                    onChange={(e) => updateRegionName(color.hex, e.target.value)}
                  />
                </div>
              </div>
            ))
          )}
        </div>

        <div className="bg-[#0f1117] rounded-xl border border-border/50 p-4 flex items-center justify-center min-h-[300px]">
          <div className="text-center">
            <p className="text-xs text-muted-foreground mb-4 font-medium uppercase tracking-wider">Preview do SVG</p>
            <img 
              src={svgUrl} 
              alt="SVG Preview" 
              className="max-w-full max-h-[400px] object-contain" 
            />
          </div>
        </div>
      </div>

      <div className="pt-4 border-t border-border/30 flex justify-end">
        <Button onClick={handleSave} disabled={saving} className="bg-[#534AB7] hover:bg-[#534AB7]/90 text-white">
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
          Salvar Mapeamento
        </Button>
      </div>
    </div>
  );
}
