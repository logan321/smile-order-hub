import { useState } from 'react';
import { useSiteConfig, SiteConfig } from '@/hooks/useSiteConfig';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Save } from 'lucide-react';

const AdminConfigPage = () => {
  const { configs, isLoading, getConfig } = useSiteConfig();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [localValues, setLocalValues] = useState<Record<string, string>>({});

  const handleUpdateLocal = (key: string, value: string) => {
    setLocalValues((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async (config: SiteConfig) => {
    const newValue = localValues[config.key];
    if (newValue === undefined) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('site_config')
        .update({ value: newValue })
        .eq('key', config.key);

      if (error) throw error;

      toast({
        title: 'Configuração salva',
        description: `${config.label} atualizada com sucesso.`,
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Erro ao salvar',
        description: error.message,
      });
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-10 px-4">
      <h1 className="text-3xl font-bold mb-8">Configurações do Site</h1>
      
      <div className="grid gap-6">
        {configs?.map((config) => (
          <Card key={config.key}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">{config.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  {config.type === 'color' ? (
                    <div className="flex items-center gap-3">
                      <Input
                        type="color"
                        className="w-12 h-12 p-1 rounded cursor-pointer"
                        value={localValues[config.key] ?? config.value}
                        onChange={(e) => handleUpdateLocal(config.key, e.target.value)}
                      />
                      <Input
                        type="text"
                        value={localValues[config.key] ?? config.value}
                        onChange={(e) => handleUpdateLocal(config.key, e.target.value)}
                        className="font-mono"
                      />
                    </div>
                  ) : (
                    <Input
                      type="text"
                      value={localValues[config.key] ?? config.value}
                      onChange={(e) => handleUpdateLocal(config.key, e.target.value)}
                    />
                  )}
                </div>
                
                <Button 
                  onClick={() => handleSave(config)} 
                  disabled={saving || localValues[config.key] === undefined}
                  size="sm"
                >
                  <Save className="w-4 h-4 mr-2" />
                  Salvar
                </Button>
              </div>

              {/* Live Preview Section */}
              <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                <p className="text-xs text-gray-500 mb-2 uppercase font-semibold">Preview ao vivo</p>
                {config.key === 'primary_color' || config.key === 'button_orcamento_text' ? (
                  <Button 
                    style={{ backgroundColor: localValues['primary_color'] ?? getConfig('primary_color') }}
                    className="text-white font-bold"
                  >
                    {localValues['button_orcamento_text'] ?? getConfig('button_orcamento_text')}
                  </Button>
                ) : config.type === 'color' ? (
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-8 h-8 rounded border" 
                      style={{ backgroundColor: localValues[config.key] ?? config.value }} 
                    />
                    <span className="text-sm">Exemplo de cor aplicada</span>
                  </div>
                ) : config.type === 'icon' ? (
                  <img 
                    src={localValues[config.key] ?? config.value} 
                    alt="Preview Ícone" 
                    className="w-10 h-10 object-contain bg-white p-1 rounded border"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = 'https://via.placeholder.com/40?text=SVG';
                    }}
                  />
                ) : (
                  <span className="text-sm font-medium">
                    {localValues[config.key] ?? config.value}
                  </span>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default AdminConfigPage;
