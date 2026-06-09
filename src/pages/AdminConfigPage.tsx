import { useState, useEffect, useRef } from 'react';
import { useSiteConfigContext } from '@/contexts/SiteConfigContext';
import { SiteConfig } from '@/types/siteConfig';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Save, RotateCcw, Download, Eye, Palette, FileText, Image as ImageIcon, Layout, ArrowLeft, Upload, Trash2, X } from 'lucide-react';
import { ConfigIcon } from '@/components/ConfigIcon';
import { useNavigate } from 'react-router-dom';

const AdminConfigPage = () => {
  const { allConfigs, isLoading, refresh, configs: currentConfigs } = useSiteConfigContext();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [saving, setSaving] = useState<string | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const [localValues, setLocalValues] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeUploadKey, setActiveUploadKey] = useState<string | null>(null);

  useEffect(() => {
    if (allConfigs.length > 0) {
      const initialValues: Record<string, string> = {};
      allConfigs.forEach(c => {
        initialValues[c.key] = c.value;
      });
      setLocalValues(initialValues);
    }
  }, [allConfigs]);

  const handleUpdateLocal = (key: string, value: string) => {
    setLocalValues((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async (config: SiteConfig) => {
    const newValue = localValues[config.key];
    setSaving(config.key);
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
      refresh();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Erro ao salvar',
        description: error.message,
      });
    } finally {
      setSaving(null);
    }
  };

  const handleResetDefaults = async () => {
    if (!confirm('Deseja realmente restaurar todos os padrões? Isso removerá todas as suas personalizações do banco de dados.')) return;
    
    setSaving('reset-all');
    try {
      // Clear all values in the database (or we could delete the rows)
      // Setting value to empty string will trigger the fallback to DEFAULT_CONFIGS
      const { error } = await supabase
        .from('site_config')
        .update({ value: '' });

      if (error) throw error;

      toast({
        title: 'Padrões restaurados',
        description: 'O site voltou à aparência original.',
      });
      refresh();
      
      // Update local state to show the empty values (which will reflect defaults in UI)
      const resetValues: Record<string, string> = {};
      allConfigs.forEach(c => {
        resetValues[c.key] = '';
      });
      setLocalValues(resetValues);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Erro ao restaurar',
        description: error.message,
      });
    } finally {
      setSaving(null);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>, configKey: string) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validation: Increase limit to 5MB for SVGs
    const isSvg = file.type === 'image/svg+xml' || file.name.endsWith('.svg');
    const maxSize = 5 * 1024 * 1024; // 5MB
    
    if (file.size > maxSize) {
      toast({
        variant: 'destructive',
        title: 'Arquivo muito grande',
        description: 'O tamanho máximo permitido é 5MB.',
      });
      return;
    }

    const allowedTypes = ['image/svg+xml', 'image/png', 'image/jpeg', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      toast({
        variant: 'destructive',
        title: 'Tipo de arquivo inválido',
        description: 'Apenas SVG, PNG, JPG e WEBP são permitidos.',
      });
      return;
    }

    setUploading(configKey);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${configKey}-${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { data, error: uploadError } = await supabase.storage
        .from('site-assets')
        .upload(filePath, file, { 
          upsert: true,
          contentType: isSvg ? 'image/svg+xml' : file.type,
          cacheControl: '0'
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('site-assets')
        .getPublicUrl(filePath);

      // Save to database
      const { error: dbError } = await supabase
        .from('site_config')
        .upsert({ 
          key: configKey, 
          value: publicUrl,
          type: 'image',
          label: allConfigs.find((c: any) => c.key === configKey)?.label || configKey,
          category: 'ícones'
        } as any, { onConflict: 'key' });

      if (dbError) throw dbError;

      handleUpdateLocal(configKey, publicUrl);
      
      toast({
        title: 'Upload concluído',
        description: 'A imagem foi enviada e salva com sucesso.',
      });
      refresh();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Erro no upload',
        description: error.message,
      });
    } finally {
      setUploading(null);
      setActiveUploadKey(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemoveFile = async (configKey: string) => {
    setSaving(configKey);
    try {
      // Clear value in database
      const { error } = await supabase
        .from('site_config')
        .update({ value: '' })
        .eq('key', configKey);

      if (error) throw error;

      handleUpdateLocal(configKey, '');
      toast({
        title: 'Arquivo removido',
        description: 'A configuração voltou ao padrão original.',
      });
      refresh();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Erro ao remover',
        description: error.message,
      });
    } finally {
      setSaving(null);
    }
  };

  const triggerUpload = (key: string) => {
    setActiveUploadKey(key);
    fileInputRef.current?.click();
  };

  const categories = ['cores', 'textos', 'ícones', 'layout'];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin mx-auto text-primary mb-4" />
          <p className="text-muted-foreground">Carregando configurações...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/50 pb-20">
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept=".svg,.png,.jpg,.jpeg,.webp"
        onChange={(e) => activeUploadKey && handleFileUpload(e, activeUploadKey)}
      />
      {/* Header Fixo */}
      <div className="sticky top-0 z-30 bg-white border-b shadow-sm mb-8">
        <div className="container mx-auto py-4 px-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/admin')}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Personalização Visual</h1>
              <p className="text-sm text-slate-500">Altere a aparência do site sem mexer no código</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleResetDefaults}>
              <RotateCcw className="w-4 h-4 mr-2" />
              Padrões
            </Button>
            <Button variant="outline" onClick={() => window.open('/meu-editor', '_blank')}>
              <Eye className="w-4 h-4 mr-2" />
              Ver Site
            </Button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Painel de Edição */}
          <div className="lg:col-span-2">
            <Tabs defaultValue="cores" className="w-full">
              <TabsList className="grid grid-cols-4 mb-8 bg-white border shadow-sm h-auto p-1">
                <TabsTrigger value="cores" className="py-3 data-[state=active]:bg-slate-100">
                  <Palette className="w-4 h-4 mr-2" />
                  Cores
                </TabsTrigger>
                <TabsTrigger value="textos" className="py-3 data-[state=active]:bg-slate-100">
                  <FileText className="w-4 h-4 mr-2" />
                  Textos
                </TabsTrigger>
                <TabsTrigger value="ícones" className="py-3 data-[state=active]:bg-slate-100">
                  <ImageIcon className="w-4 h-4 mr-2" />
                  Ícones
                </TabsTrigger>
                <TabsTrigger value="layout" className="py-3 data-[state=active]:bg-slate-100">
                  <Layout className="w-4 h-4 mr-2" />
                  Layout
                </TabsTrigger>
              </TabsList>

              {categories.map(category => (
                <TabsContent key={category} value={category} className="space-y-6 mt-0">
                  <div className="grid gap-4">
                    {allConfigs
                      .filter(c => c.category === category)
                      .map((config) => (
                        <Card key={config.key} className="overflow-hidden border-slate-200 shadow-sm transition-all hover:shadow-md">
                          <CardContent className="p-4 md:p-6">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                              <div className="space-y-1 flex-1">
                                <Label className="text-sm font-semibold text-slate-700">{config.label}</Label>
                                <CardDescription className="text-xs">Chave: <code className="bg-slate-100 px-1 rounded">{config.key}</code></CardDescription>
                                
                                <div className="mt-4">
                                  {config.type === 'color' ? (
                                    <div className="flex items-center gap-3">
                                      <div className="relative group">
                                        <Input
                                          type="color"
                                          className="w-14 h-14 p-1 rounded-xl cursor-pointer border-2"
                                          value={localValues[config.key] ?? config.value}
                                          onChange={(e) => handleUpdateLocal(config.key, e.target.value)}
                                        />
                                      </div>
                                      <Input
                                        type="text"
                                        value={localValues[config.key] ?? config.value}
                                        onChange={(e) => handleUpdateLocal(config.key, e.target.value)}
                                        className="font-mono max-w-[150px]"
                                        placeholder="#000000"
                                      />
                                    </div>
                                  ) : config.type === 'image' || config.type === 'icon' ? (
                                    <div className="space-y-4">
                                      <div className="flex flex-col sm:flex-row gap-4">
                                        <div className="flex-1 space-y-2">
                                          <Input
                                            type="text"
                                            value={localValues[config.key] ?? config.value}
                                            onChange={(e) => handleUpdateLocal(config.key, e.target.value)}
                                            placeholder="URL da imagem ou SVG inline"
                                          />
                                          <div className="flex gap-2">
                                            <Button 
                                              type="button" 
                                              variant="outline" 
                                              size="sm" 
                                              className="flex-1"
                                              onClick={() => triggerUpload(config.key)}
                                              disabled={uploading === config.key}
                                            >
                                              {uploading === config.key ? (
                                                <Loader2 className="w-3 h-3 animate-spin mr-2" />
                                              ) : (
                                                <Upload className="w-3 h-3 mr-2" />
                                              )}
                                              Importar
                                            </Button>
                                            
                                            {(localValues[config.key] || config.value) && (
                                              <Button 
                                                type="button" 
                                                variant="ghost" 
                                                size="sm" 
                                                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                                onClick={() => handleRemoveFile(config.key)}
                                                disabled={saving === config.key}
                                              >
                                                <Trash2 className="w-3 h-3 mr-2" />
                                                Remover
                                              </Button>
                                            )}
                                          </div>
                                        </div>
                                        
                                        <div className="w-20 h-20 rounded-lg border-2 border-dashed border-slate-200 flex items-center justify-center bg-white overflow-hidden shrink-0">
                                          <ConfigIcon 
                                            icon={localValues[config.key] || config.value} 
                                            className="w-12 h-12 text-slate-400"
                                            fallback={<ImageIcon className="w-8 h-8 text-slate-200" />}
                                          />
                                        </div>
                                      </div>
                                      <p className="text-[10px] text-slate-400">Recomendado: SVG para ícones e PNG transparente para logo. Máx 5MB.</p>
                                    </div>
                                  ) : (
                                    <Input
                                      type="text"
                                      value={localValues[config.key] ?? config.value}
                                      onChange={(e) => handleUpdateLocal(config.key, e.target.value)}
                                    />
                                  )}
                                </div>
                              </div>
                              
                              <div className="flex flex-row md:flex-col items-center justify-end gap-3 pt-4 md:pt-0 border-t md:border-t-0 md:pl-6 border-slate-100">
                                <Button 
                                  onClick={() => handleSave(config)} 
                                  disabled={saving === config.key || localValues[config.key] === config.value}
                                  className="w-full md:w-32 bg-slate-900 hover:bg-slate-800"
                                >
                                  {saving === config.key ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                  ) : (
                                    <>
                                      <Save className="w-4 h-4 mr-2" />
                                      Salvar
                                    </>
                                  )}
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                  </div>
                </TabsContent>
              ))}
            </Tabs>
          </div>

          {/* Coluna de Preview Lateral */}
          <div className="lg:col-span-1 space-y-6">
            <div className="sticky top-28 space-y-6">
              <Card className="border-slate-200 shadow-lg bg-white overflow-hidden">
                <CardHeader className="bg-slate-900 text-white p-4">
                  <CardTitle className="text-base flex items-center">
                    <Eye className="w-4 h-4 mr-2" />
                    Preview em Tempo Real
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6 space-y-8">
                  {/* Mock de Header */}
                  <div className="space-y-2">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Header & Logo</p>
                    <div 
                      className="border rounded-lg p-3 flex items-center justify-between"
                      style={{ 
                        backgroundColor: localValues['header_bg_color'] ?? currentConfigs['header_bg_color'],
                        color: localValues['header_text_color'] ?? currentConfigs['header_text_color']
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <ConfigIcon 
                          icon={localValues['logo_url'] ?? currentConfigs['logo_url']} 
                          className="h-5 w-auto"
                        />
                        <span className="font-bold text-sm">
                          {localValues['app_title'] ?? currentConfigs['app_title']}
                        </span>
                      </div>
                      <div className="w-4 h-4 rounded-full bg-slate-200 opacity-50" />
                    </div>
                  </div>

                  {/* Mock de Botões Principais */}
                  <div className="space-y-4">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Botões & Ações</p>
                    <div className="grid gap-3">
                      <Button 
                        className="w-full font-bold shadow-md"
                        style={{ 
                          backgroundColor: localValues['primary_color'] ?? currentConfigs['primary_color'],
                          borderRadius: localValues['border_radius_buttons'] ?? currentConfigs['border_radius_buttons'],
                        }}
                      >
                        {localValues['orcamento_button_text'] ?? currentConfigs['orcamento_button_text']}
                      </Button>
                      
                      <div className="flex gap-2">
                         <Button 
                          variant="outline"
                          className="flex-1 text-xs"
                          style={{ 
                            borderColor: localValues['border_color'] ?? currentConfigs['border_color'],
                            borderRadius: localValues['border_radius_buttons'] ?? currentConfigs['border_radius_buttons'],
                          }}
                        >
                          {localValues['resetar_design_text'] ?? currentConfigs['resetar_design_text']}
                        </Button>
                        <Button 
                          variant="outline"
                          className="flex-1 text-xs"
                          style={{ 
                            borderRadius: localValues['border_radius_buttons'] ?? currentConfigs['border_radius_buttons'],
                          }}
                        >
                          <Download className="w-3 h-3 mr-1" />
                          Download
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Mock de Sidebar & Abas */}
                  <div className="space-y-2">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Interface lateral (Abas)</p>
                    <div 
                      className="border rounded-xl p-4 space-y-4"
                      style={{ 
                        backgroundColor: localValues['sidebar_bg_color'] ?? currentConfigs['sidebar_bg_color'],
                        color: localValues['sidebar_text_color'] ?? currentConfigs['sidebar_text_color']
                      }}
                    >
                      <div className="flex justify-between gap-1">
                        {['estampa', 'texto', 'nome', 'escudo'].map((tab) => (
                          <div 
                            key={tab}
                            className="flex-1 aspect-square rounded-lg flex flex-col items-center justify-center gap-1 border border-slate-100"
                            style={{ 
                              backgroundColor: tab === 'estampa' ? (localValues['accent_color'] ?? currentConfigs['accent_color']) + '15' : 'transparent',
                              borderColor: tab === 'estampa' ? (localValues['accent_color'] ?? currentConfigs['accent_color']) : 'transparent'
                            }}
                          >
                            <div className="w-4 h-4 rounded-sm bg-slate-300 opacity-40" />
                            <span className="text-[8px] font-bold">
                              {localValues[`${tab}_tab_label`] ?? currentConfigs[`${tab}_tab_label`]}
                            </span>
                          </div>
                        ))}
                      </div>
                      <div className="space-y-2">
                        <div className="h-2 w-1/2 bg-slate-200 rounded opacity-40" />
                        <div className="h-8 w-full bg-slate-100 rounded border border-slate-200" />
                      </div>
                    </div>
                  </div>

                  {/* Mock de Canvas 3D */}
                  <div className="space-y-2">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Ambiente 3D</p>
                    <div 
                      className="aspect-video rounded-xl flex items-center justify-center border-2 border-dashed border-slate-200"
                      style={{ backgroundColor: localValues['canvas_bg_color'] ?? currentConfigs['canvas_bg_color'] }}
                    >
                      <div className="flex flex-col items-center gap-2 opacity-30">
                        <Palette className="w-8 h-8" />
                        <span className="text-[10px] font-bold">3D SCENE AREA</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-slate-200 shadow-sm bg-slate-100">
                <CardContent className="p-4 text-center">
                  <p className="text-[11px] text-slate-500 italic">
                    Dica: Use URLs de SVGs para ícones perfeitos. Você pode usar ícones do Flaticon ou hospedar seus próprios arquivos.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminConfigPage;
