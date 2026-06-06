import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { extractColorsFromUvSvg } from '@/lib/uvCompositor';
import { Save, RefreshCcw, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  stampId: string;
  svgUrl: string;
}

interface ColorInfo {
  hex: string;
  count: number;
  region_name: string;
  is_editable: boolean;
}

export default function StampColorMappingManager({ stampId, svgUrl }: Props) {
  const [colors, setColors] = useState<ColorInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchMappings = async () => {
    setLoading(true);
    try {
      const { data: existing, error: fetchError } = await supabase
        .from('uv_color_mappings')
        .select('original_color, region_name, is_editable, sort_order')
        .eq('stamp_id', stampId);
      if (fetchError) throw fetchError;

      const res = await fetch(svgUrl);
      const svgText = await res.text();
      const isSvg = svgText.trim().startsWith('<') && /<svg[\s>]/i.test(svgText);
      if (!isSvg) {
        toast.error('O arquivo UV vinculado não é um SVG válido.');
        setColors([]);
        return;
      }
      const svgColors = extractColorsFromUvSvg(svgText);
      const merged: ColorInfo[] = svgColors.map(c => {
        const ex = existing?.find(e => e.original_color.toUpperCase() === c.hex.toUpperCase());
        return {
          hex: c.hex,
          count: c.count,
          region_name: ex?.region_name || '',
          is_editable: ex?.is_editable ?? true,
        };
      });
      setColors(merged);
    } catch (e: any) {
      toast.error('Erro ao carregar: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchMappings(); }, [stampId, svgUrl]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await supabase.from('uv_color_mappings').delete().eq('stamp_id', stampId);
      const rows = colors
        .filter(c => c.region_name.trim() !== '')
        .map((c, i) => ({
          stamp_id: stampId,
          template_id: null,
          original_color: c.hex,
          region_name: c.region_name.trim(),
          is_editable: c.is_editable,
          sort_order: i,
        }));
      if (rows.length > 0) {
        const { error } = await supabase.from('uv_color_mappings').insert(rows);
        if (error) throw error;
      }
      toast.success('Cores da estampa salvas!');
    } catch (e: any) {
      toast.error('Erro ao salvar: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  const update = (hex: string, patch: Partial<ColorInfo>) =>
    setColors(prev => prev.map(c => c.hex === hex ? { ...c, ...patch } : c));

  if (loading) return (
    <div className="flex items-center gap-3 text-muted-foreground py-6 px-4 bg-muted/30 rounded-lg border">
      <Loader2 className="h-5 w-5 animate-spin text-primary" />
      <span className="text-sm">Escaneando cores do SVG da estampa...</span>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Nomeie cada cor encontrada no SVG e marque quais o cliente poderá alterar.
        </p>
        <Button size="sm" variant="outline" onClick={fetchMappings}>
          <RefreshCcw className="h-3.5 w-3.5 mr-2" /> Recarregar
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2 max-h-[480px] overflow-y-auto pr-2">
          {colors.length === 0 ? (
            <div className="text-center py-10 border border-dashed rounded-lg text-sm text-muted-foreground">
              Nenhuma cor detectada no SVG.
            </div>
          ) : colors.map(color => (
            <div key={color.hex} className="flex items-center gap-3 p-3 rounded-lg border bg-card">
              <div
                className="w-10 h-10 rounded-md border shrink-0 flex items-center justify-center text-[10px] font-bold"
                style={{ backgroundColor: color.hex, color: contrast(color.hex) }}
              >
                {color.count}
              </div>
              <div className="flex-1 min-w-0 space-y-1">
                <div className="text-[10px] font-mono uppercase text-muted-foreground">{color.hex}</div>
                <Input
                  placeholder="Ex: Gola, Manga Esquerda, Corpo"
                  className="h-8 text-xs"
                  value={color.region_name}
                  onChange={e => update(color.hex, { region_name: e.target.value })}
                />
              </div>
              <div className="flex flex-col items-center gap-1 shrink-0">
                <Switch
                  checked={color.is_editable}
                  onCheckedChange={v => update(color.hex, { is_editable: v })}
                />
                <Label className="text-[9px] text-muted-foreground uppercase">Editável</Label>
              </div>
            </div>
          ))}
        </div>
        <div className="rounded-lg border p-4 flex items-center justify-center bg-muted/20 min-h-[300px]">
          <img src={svgUrl} alt="UV preview" className="max-w-full max-h-[400px] object-contain" />
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
          Salvar Cores
        </Button>
      </div>
    </div>
  );
}

function contrast(hex: string) {
  const h = hex.replace('#', '');
  const r = parseInt(h.substr(0,2),16);
  const g = parseInt(h.substr(2,2),16);
  const b = parseInt(h.substr(4,2),16);
  return ((r*299+g*587+b*114)/1000) >= 128 ? 'black' : 'white';
}