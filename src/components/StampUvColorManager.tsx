import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { extractColorsFromSvg } from '@/lib/uvCompositor';
import { Save, RefreshCcw, Loader2, Palette } from 'lucide-react';
import { toast } from 'sonner';
import { useStampUvColors } from '@/hooks/useStampUvColors';

interface StampUvColorManagerProps {
  stampId: string;
  svgUrl: string;
  stampName: string;
}

interface ColorMappingState {
  hex: string;
  region_name: string;
  is_editable: boolean;
}

export default function StampUvColorManager({ stampId, svgUrl, stampName }: StampUvColorManagerProps) {
  const { data: existingMappings, isLoading: loadingExisting, saveMappings } = useStampUvColors(stampId);
  const [colors, setColors] = useState<ColorMappingState[]>([]);
  const [loadingSvg, setLoadingSvg] = useState(false);
  const [saving, setSaving] = useState(false);

  const processSvg = async () => {
    if (!svgUrl) return;
    setLoadingSvg(true);
    try {
      const res = await fetch(svgUrl);
      const svgText = await res.text();
      const svgColors = extractColorsFromSvg(svgText);

      const colorMappings: ColorMappingState[] = svgColors.map(hex => {
        const existing = existingMappings?.find(m => m.original_color.toUpperCase() === hex.toUpperCase());
        return {
          hex,
          region_name: existing?.region_name || '',
          is_editable: existing ? existing.is_editable : true,
        };
      });

      setColors(colorMappings);
    } catch (error: any) {
      toast.error('Erro ao extrair cores do SVG: ' + error.message);
    } finally {
      setLoadingSvg(false);
    }
  };

  useEffect(() => {
    if (!loadingExisting) {
      processSvg();
    }
  }, [stampId, svgUrl, loadingExisting]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const toSave = colors
        .filter(c => c.region_name.trim() !== '')
        .map((c, index) => ({
          stamp_id: stampId,
          original_color: c.hex,
          region_name: c.region_name,
          is_editable: c.is_editable,
          sort_order: index,
        }));

      await saveMappings.mutateAsync(toSave);
    } finally {
      setSaving(false);
    }
  };

  const updateColor = (hex: string, updates: Partial<ColorMappingState>) => {
    setColors(prev => prev.map(c => c.hex === hex ? { ...c, ...updates } : c));
  };

  if (loadingExisting || loadingSvg) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin mb-2" />
        <p>Analisando SVG da estampa...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-border/50 pb-4">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Palette className="h-5 w-5 text-primary" />
            Cores da Estampa: {stampName}
          </h3>
          <p className="text-sm text-muted-foreground">
            Defina quais cores do SVG são editáveis pelo cliente
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={processSvg}>
          <RefreshCcw className="h-4 w-4 mr-2" />
          Recarregar SVG
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-4">
          {colors.length === 0 ? (
            <div className="p-8 text-center border border-dashed border-border rounded-xl">
              <p className="text-sm text-muted-foreground italic">Nenhuma cor detectada no SVG.</p>
            </div>
          ) : (
            <div className="grid gap-3">
              {colors.map((color) => (
                <div key={color.hex} className="flex items-center gap-4 p-4 rounded-xl border border-border/50 bg-muted/20">
                  <div 
                    className="w-12 h-12 rounded-lg border border-white/10 shadow-md shrink-0" 
                    style={{ backgroundColor: color.hex }}
                  />
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono text-muted-foreground uppercase">{color.hex}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">Editável:</span>
                        <Switch 
                          checked={color.is_editable}
                          onCheckedChange={(val) => updateColor(color.hex, { is_editable: val })}
                        />
                      </div>
                    </div>
                    <Input 
                      placeholder="Ex: Gola, Punho, Detalhe" 
                      className="h-9 bg-background"
                      value={color.region_name}
                      onChange={(e) => updateColor(color.hex, { region_name: e.target.value })}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="bg-muted/30 rounded-2xl border border-border/50 p-6 flex flex-col items-center justify-center min-h-[400px]">
            <p className="text-xs font-semibold text-muted-foreground mb-6 uppercase tracking-wider">Visualização do UV</p>
            <div className="relative group">
              <img 
                src={svgUrl} 
                alt="Stamp UV" 
                className="max-w-full max-h-[350px] object-contain drop-shadow-2xl" 
              />
            </div>
            <p className="mt-6 text-[10px] text-muted-foreground max-w-xs text-center">
              Este é o SVG de UV usado para esta estampa. As cores acima correspondem às regiões mostradas aqui.
            </p>
          </div>

          <div className="p-4 bg-primary/5 rounded-xl border border-primary/10">
            <h4 className="text-sm font-semibold mb-2">Dica</h4>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Dê nomes claros para as regiões (ex: "Corpo", "Manga"). Apenas regiões com nome preenchido serão salvas e aparecerão para o cliente.
            </p>
          </div>
        </div>
      </div>

      <div className="flex justify-end pt-6 border-t border-border/50">
        <Button 
          onClick={handleSave} 
          disabled={saving || colors.length === 0} 
          size="lg"
          className="px-8"
        >
          {saving ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <Save className="h-5 w-5 mr-2" />}
          Salvar Configurações
        </Button>
      </div>
    </div>
  );
}
