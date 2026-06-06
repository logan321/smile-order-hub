import React, { useState, useEffect, useCallback } from 'react';
import { extractColorsFromSvg } from '@/lib/uvCompositor';
import { useStampColorMappings, NewStampColorMapping } from '@/hooks/useStampColorMappings';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Loader2, Palette, Save, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';

interface StampColorEditorProps {
  stampId: string;
  stampName: string;
  uvSvgUrl: string | null;
}

interface ColorItem {
  hex: string;
  regionName: string;
  isEditable: boolean;
}

const StampColorEditor: React.FC<StampColorEditorProps> = ({ stampId, stampName, uvSvgUrl }) => {


  const { mappings, isLoading: isMappingsLoading, saveMappings } = useStampColorMappings(stampId);
  const [svgColors, setSvgColors] = useState<string[]>([]);
  const [localMappings, setLocalMappings] = useState<ColorItem[]>([]);
  const [isSvgLoading, setIsSvgLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Fetch SVG and extract colors
  useEffect(() => {
    const loadSvgColors = async () => {
      if (!uvSvgUrl) return;
      setIsSvgLoading(true);
      try {
        const response = await fetch(uvSvgUrl);
        const svgText = await response.text();
        const colors = extractColorsFromSvg(svgText);
        setSvgColors(colors);
      } catch (err) {
        console.error('Error extracting colors from SVG:', err);
        toast.error('Erro ao processar o SVG da estampa');
      } finally {
        setIsSvgLoading(false);
      }
    };

    loadSvgColors();
  }, [uvSvgUrl]);

  // Merge SVG colors with saved mappings
  useEffect(() => {
    if (svgColors.length > 0) {
      const merged = svgColors.map((hex) => {
        const existing = mappings.find(m => m.original_color.toUpperCase() === hex.toUpperCase());
        return {
          hex,
          regionName: existing?.region_name || '',
          isEditable: existing ? existing.is_editable : true
        };
      });
      setLocalMappings(merged);
    }
  }, [svgColors, mappings]);

  const handleUpdateMapping = (hex: string, field: keyof ColorItem, value: string | boolean) => {
    setLocalMappings(prev => prev.map(item => 
      item.hex === hex ? { ...item, [field]: value } : item
    ));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const mappingsToSave: NewStampColorMapping[] = localMappings.map((item, index) => ({
        original_color: item.hex,
        region_name: item.regionName,
        is_editable: item.isEditable,
        sort_order: index
      }));
      
      await saveMappings(mappingsToSave);
      // useStampColorMappings already shows a success toast
    } catch (err) {
      // useStampColorMappings already shows an error toast
      console.error('Error saving mappings:', err);
    } finally {
      setIsSaving(false);
    }
  };

  if (!uvSvgUrl) {
    return (
      <Card className="border-dashed border-2">
        <CardContent className="flex flex-col items-center justify-center py-10 text-muted-foreground">
          <AlertCircle className="h-10 w-10 mb-4 opacity-20" />
          <p>Esta estampa não possui SVG de UV vinculado</p>
        </CardContent>
      </Card>
    );
  }

  const isLoading = isSvgLoading || isMappingsLoading;

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Palette className="h-5 w-5 text-primary" />
          Configuração de Cores: {stampName}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-12 gap-2 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin" />
            <p className="text-sm">Carregando cores e configurações...</p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid gap-4">
              {localMappings.length === 0 ? (
                <p className="text-center py-6 text-muted-foreground italic">
                  Nenhuma cor detectada no SVG.
                </p>
              ) : (
                localMappings.map((item) => (
                  <div 
                    key={item.hex} 
                    className="flex flex-col sm:flex-row items-start sm:items-center gap-4 p-4 rounded-lg border bg-card/50"
                  >
                    <div className="flex items-center gap-3 shrink-0">
                      <div 
                        className="h-10 w-10 rounded border shadow-sm" 
                        style={{ backgroundColor: item.hex }}
                        title={item.hex}
                      />
                      <span className="font-mono text-xs text-muted-foreground uppercase w-16">
                        {item.hex}
                      </span>
                    </div>
                    
                    <div className="flex-1 w-full sm:w-auto">
                      <Input
                        placeholder="Nome da região (ex: Gola, Manga...)"
                        value={item.regionName}
                        onChange={(e) => handleUpdateMapping(item.hex, 'regionName', e.target.value)}
                        className="h-9"
                      />
                    </div>
                    
                    <div className="flex items-center gap-2 shrink-0">
                      <label className="text-xs font-medium text-muted-foreground cursor-pointer" htmlFor={`editable-${item.hex}`}>
                        Editável
                      </label>
                      <Switch
                        id={`editable-${item.hex}`}
                        checked={item.isEditable}
                        onCheckedChange={(checked) => handleUpdateMapping(item.hex, 'isEditable', checked)}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="flex justify-end pt-4 border-t">
              <Button 
                onClick={handleSave} 
                disabled={isSaving || localMappings.length === 0}
                className="w-full sm:w-auto min-w-[120px]"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Salvar
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default StampColorEditor;
