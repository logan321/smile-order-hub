import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { extractColorsFromUvSvg } from '@/lib/uvCompositor';
import { Save, RefreshCcw, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface UvColorMappingManagerProps {
  templateId: string;
  svgUrl: string;
}

interface ColorInfo {
  hex: string;
  count: number;
  region_name: string;
}

export default function UvColorMappingManager({ templateId, svgUrl }: UvColorMappingManagerProps) {
  const [colors, setColors] = useState<ColorInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchMappings = async () => {
    setLoading(true);
    try {
      const { data: existingMappings, error: fetchError } = await supabase
        .from('uv_color_mappings')
        .select('*')
        .eq('template_id', templateId);

      if (fetchError) throw fetchError;

      const res = await fetch(svgUrl);
      const svgText = await res.text();
      const svgColors = extractColorsFromUvSvg(svgText);

      const colorInfos: ColorInfo[] = svgColors.map(c => {
        const existing = existingMappings?.find(m => m.original_color.toUpperCase() === c.hex.toUpperCase());
        return {
          ...c,
          region_name: existing?.region_name || '',
        };
      });

      setColors(colorInfos);
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
      await supabase
        .from('uv_color_mappings')
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
          .from('uv_color_mappings')
          .insert(toInsert);
        if (error) throw error;
      }

      toast.success('Mapeamento de Cores do UV salvo!');
    } catch (error: any) {
      toast.error('Erro ao salvar: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const updateRegionName = (hex: string, name: string) => {
    setColors(prev => prev.map(c => c.hex === hex ? { ...c, region_name: name } : c));
  };

  if (loading) return (
    <div className="flex items-center gap-3 text-muted-foreground py-6 px-4 bg-[#1a1d2e] rounded-lg border border-white/5">
      <Loader2 className="h-5 w-5 animate-spin text-[#534AB7]" /> 
      <span className="text-sm font-medium">Escaneando regiões do Molde UV...</span>
    </div>
  );

  return (
    <div className="space-y-6 bg-[#0f1117] p-6 rounded-xl border border-white/5 shadow-2xl">
      <div className="flex items-center justify-between border-b border-white/5 pb-4">
        <div>
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            Mapear Cores do UV
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            Defina nomes amigáveis para cada cor hexadecimal encontrada no molde.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={fetchMappings} disabled={loading} className="h-9 border-white/10 text-white hover:bg-white/5 bg-transparent">
          <RefreshCcw className="h-3.5 w-3.5 mr-2" />
          Recarregar
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-3 max-h-[500px] overflow-y-auto pr-3 custom-scrollbar">
          {colors.length === 0 ? (
            <div className="text-center py-12 border border-dashed border-white/10 rounded-xl">
              <p className="text-sm text-muted-foreground italic">Nenhuma cor detectada no SVG do molde.</p>
            </div>
          ) : (
            colors.map((color) => (
              <div key={color.hex} className="group flex items-center gap-4 p-3 rounded-xl border border-white/5 bg-[#1a1d2e] hover:border-[#534AB7]/30 transition-all">
                <div 
                   className="w-12 h-12 rounded-lg border border-white/10 shrink-0 shadow-lg flex items-center justify-center text-[10px] font-bold" 
                   style={{ backgroundColor: color.hex, color: getContrastYIQ(color.hex) }}
                >
                  {color.count}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-mono uppercase text-muted-foreground tracking-tighter">{color.hex}</span>
                    <span className="text-[9px] text-muted-foreground font-medium uppercase opacity-0 group-hover:opacity-100 transition-opacity">
                      {color.count} {color.count === 1 ? 'elemento' : 'elementos'}
                    </span>
                  </div>
                  <Input 
                    placeholder="Ex: Corpo Frente, Gola, Manga" 
                    className="h-9 text-xs bg-[#0f1117] border-white/10 text-white placeholder:text-muted-foreground/30 focus:border-[#534AB7] focus:ring-1 focus:ring-[#534AB7]"
                    value={color.region_name}
                    onChange={(e) => updateRegionName(color.hex, e.target.value)}
                  />
                </div>
              </div>
            ))
          )}
        </div>

        <div className="bg-[#0f1117] rounded-2xl border border-white/5 p-6 flex flex-col items-center justify-center min-h-[400px] shadow-inner relative overflow-hidden">
            <div className="absolute top-4 left-6">
               <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-[0.2em] opacity-50">Preview do Molde</p>
            </div>
            <div className="relative group w-full h-full flex items-center justify-center">
              <img 
                src={svgUrl} 
                alt="UV Preview" 
                className="max-w-full max-h-[350px] object-contain transition-all duration-500 group-hover:scale-105" 
              />
            </div>
        </div>
      </div>

      <div className="flex justify-end pt-4 border-t border-white/5">
        <Button onClick={handleSave} disabled={saving} className="bg-[#534AB7] hover:bg-[#534AB7]/90 text-white font-bold px-8 shadow-xl shadow-indigo-500/20 transition-all hover:-translate-y-0.5 active:translate-y-0">
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
          Salvar Mapeamento
        </Button>
      </div>
    </div>
  );
}

// Helper for accessibility/contrast
function getContrastYIQ(hexcolor: string){
    hexcolor = hexcolor.replace("#", "");
    var r = parseInt(hexcolor.substr(0,2),16);
    var g = parseInt(hexcolor.substr(2,2),16);
    var b = parseInt(hexcolor.substr(4,2),16);
    var yiq = ((r*299)+(g*587)+(b*114))/1000;
    return (yiq >= 128) ? 'black' : 'white';
}
