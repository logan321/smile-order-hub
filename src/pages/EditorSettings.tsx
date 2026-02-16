import { useState, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Shirt, Stamp, Upload, Eye, EyeOff, MapPin, Fish, MessageCircle, Plus, Trash2, Save } from 'lucide-react';
import { toast } from 'sonner';
import { useShirtTemplates } from '@/hooks/useShirtTemplates';
import { useStampCatalog } from '@/hooks/useStampCatalog';
import { usePatchCatalog } from '@/hooks/usePatchCatalog';
import ZoneEditor from '@/components/ZoneEditor';

const EditorSettings = () => {
  const { templates, loading: templatesLoading, addTemplate, deleteTemplate, toggleActive } = useShirtTemplates();
  const { stamps, loading: stampsLoading, addStamp, deleteStamp } = useStampCatalog();
  const { patches, loading: patchesLoading, addPatch, deletePatch } = usePatchCatalog();

  // WhatsApp
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [whatsappLoading, setWhatsappLoading] = useState(true);

  useEffect(() => {
    const loadWhatsapp = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) { setWhatsappLoading(false); return; }
      const { data } = await supabase.from('user_settings').select('whatsapp_number').eq('user_id', session.user.id).maybeSingle();
      if (data) setWhatsappNumber(data.whatsapp_number);
      setWhatsappLoading(false);
    };
    loadWhatsapp();
  }, []);

  const handleSaveWhatsapp = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) { toast.error('Faça login primeiro'); return; }
    const { error } = await supabase.from('user_settings').upsert({
      user_id: session.user.id,
      whatsapp_number: whatsappNumber.replace(/\D/g, ''),
    }, { onConflict: 'user_id' });
    if (error) { toast.error('Erro ao salvar'); console.error(error); return; }
    toast.success('WhatsApp salvo!');
  };

  // Templates
  const [newTemplateName, setNewTemplateName] = useState('');
  const [frontFile, setFrontFile] = useState<File | null>(null);
  const [backFile, setBackFile] = useState<File | null>(null);
  const frontRef = useRef<HTMLInputElement>(null);
  const backRef = useRef<HTMLInputElement>(null);
  const [uploadingTemplate, setUploadingTemplate] = useState(false);
  const [zoneEditorTemplate, setZoneEditorTemplate] = useState<{ id: string; frontImageUrl: string; backImageUrl: string } | null>(null);

  const handleAddTemplate = async () => {
    if (!newTemplateName.trim() || !frontFile || !backFile) {
      toast.error('Preencha o nome e envie as imagens de frente e costas');
      return;
    }
    setUploadingTemplate(true);
    try {
      await addTemplate(newTemplateName.trim(), frontFile, backFile);
      setNewTemplateName('');
      setFrontFile(null);
      setBackFile(null);
      if (frontRef.current) frontRef.current.value = '';
      if (backRef.current) backRef.current.value = '';
      toast.success('Template adicionado!');
    } catch { toast.error('Erro ao adicionar template'); }
    setUploadingTemplate(false);
  };

  // Stamps
  const [newStampName, setNewStampName] = useState('');
  const [newStampCategory, setNewStampCategory] = useState('Geral');
  const [stampFrontFile, setStampFrontFile] = useState<File | null>(null);
  const [stampBackFile, setStampBackFile] = useState<File | null>(null);
  const stampFrontRef = useRef<HTMLInputElement>(null);
  const stampBackRef = useRef<HTMLInputElement>(null);
  const [uploadingStamp, setUploadingStamp] = useState(false);

  const handleAddStamp = async () => {
    if (!newStampName.trim() || !stampFrontFile || !stampBackFile) {
      toast.error('Preencha o nome e envie as imagens de frente e costas da estampa');
      return;
    }
    setUploadingStamp(true);
    try {
      await addStamp(newStampName.trim(), newStampCategory, stampFrontFile, stampBackFile);
      setNewStampName('');
      setNewStampCategory('Geral');
      setStampFrontFile(null);
      setStampBackFile(null);
      if (stampFrontRef.current) stampFrontRef.current.value = '';
      if (stampBackRef.current) stampBackRef.current.value = '';
      toast.success('Estampa adicionada!');
    } catch { toast.error('Erro ao adicionar estampa'); }
    setUploadingStamp(false);
  };

  // Patches
  const [newPatchName, setNewPatchName] = useState('');
  const [patchFile, setPatchFile] = useState<File | null>(null);
  const patchFileRef = useRef<HTMLInputElement>(null);
  const [uploadingPatch, setUploadingPatch] = useState(false);

  const handleAddPatch = async () => {
    if (!newPatchName.trim() || !patchFile) {
      toast.error('Preencha o nome e envie a imagem do peixe');
      return;
    }
    setUploadingPatch(true);
    try {
      await addPatch(newPatchName.trim(), patchFile);
      setNewPatchName('');
      setPatchFile(null);
      if (patchFileRef.current) patchFileRef.current.value = '';
      toast.success('Peixe adicionado!');
    } catch { toast.error('Erro ao adicionar peixe'); }
    setUploadingPatch(false);
  };

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <h1 className="page-title">Configurações do Editor</h1>
        <p className="page-description">Gerencie templates, estampas, peixes e WhatsApp do seu editor de camisas</p>
      </div>

      <Tabs defaultValue="templates" className="max-w-3xl">
        <TabsList className="mb-6 flex-wrap h-auto gap-1">
          <TabsTrigger value="templates" className="gap-2">
            <Shirt className="h-4 w-4" />
            Templates
          </TabsTrigger>
          <TabsTrigger value="stamps" className="gap-2">
            <Stamp className="h-4 w-4" />
            Estampas
          </TabsTrigger>
          <TabsTrigger value="patches" className="gap-2">
            <Fish className="h-4 w-4" />
            Peixes
          </TabsTrigger>
          <TabsTrigger value="whatsapp" className="gap-2">
            <MessageCircle className="h-4 w-4" />
            WhatsApp
          </TabsTrigger>
        </TabsList>

        {/* Templates */}
        <TabsContent value="templates">
          <div className="bg-card rounded-xl border border-border/50 shadow-sm p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Shirt className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1">
                <h2 className="font-semibold font-display">Templates de Camisa</h2>
                <p className="text-sm text-muted-foreground">Envie imagens de frente e costas das camisas em branco para o editor</p>
              </div>
              <a href="/meu-editor" target="_blank" rel="noopener noreferrer">
                <Button variant="outline" size="sm" className="gap-2">
                  <Eye className="h-4 w-4" />
                  Abrir Editor
                </Button>
              </a>
            </div>

            {templatesLoading ? (
              <p className="text-sm text-muted-foreground">Carregando...</p>
            ) : (
              <>
                {templates.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                    {templates.map(t => (
                      <div key={t.id} className="rounded-lg border border-border/50 bg-muted/20 overflow-hidden">
                        <div className="grid grid-cols-2 gap-1 p-2">
                          <div>
                            <p className="text-[10px] text-muted-foreground text-center mb-1">Frente</p>
                            <img src={t.frontImageUrl} alt="Frente" className="w-full aspect-[3/4] object-contain rounded bg-background" />
                          </div>
                          <div>
                            <p className="text-[10px] text-muted-foreground text-center mb-1">Costas</p>
                            <img src={t.backImageUrl} alt="Costas" className="w-full aspect-[3/4] object-contain rounded bg-background" />
                          </div>
                        </div>
                        <div className="px-3 py-2 flex items-center justify-between border-t border-border/30">
                          <span className="text-sm font-medium">{t.name}</span>
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setZoneEditorTemplate({ id: t.id, frontImageUrl: t.frontImageUrl, backImageUrl: t.backImageUrl })} title="Editar Zonas">
                              <MapPin className="h-3.5 w-3.5 text-primary" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => toggleActive(t.id, !t.active)} title={t.active ? 'Desativar' : 'Ativar'}>
                              {t.active ? <Eye className="h-3.5 w-3.5 text-primary" /> : <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />}
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { if (confirm('Remover template?')) deleteTemplate(t.id); }}>
                              <Trash2 className="h-3.5 w-3.5 text-destructive" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {templates.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground mb-4">
                    <Shirt className="h-10 w-10 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">Nenhum template cadastrado. Envie imagens de camisas em branco.</p>
                  </div>
                )}

                <div className="space-y-3 border-t border-border/50 pt-4">
                  <p className="text-sm font-medium">Adicionar novo template</p>
                  <Input value={newTemplateName} onChange={e => setNewTemplateName(e.target.value)} placeholder="Nome do modelo (ex: Camisa Polo, Baby Look)" />
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Imagem Frente *</label>
                      <div className="border border-dashed border-border rounded-lg p-3">
                        <label className="flex flex-col items-center gap-1 cursor-pointer text-center">
                          <Upload className="h-4 w-4 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">{frontFile ? frontFile.name : 'Selecionar'}</span>
                          <input ref={frontRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={e => setFrontFile(e.target.files?.[0] ?? null)} className="hidden" />
                        </label>
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Imagem Costas *</label>
                      <div className="border border-dashed border-border rounded-lg p-3">
                        <label className="flex flex-col items-center gap-1 cursor-pointer text-center">
                          <Upload className="h-4 w-4 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">{backFile ? backFile.name : 'Selecionar'}</span>
                          <input ref={backRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={e => setBackFile(e.target.files?.[0] ?? null)} className="hidden" />
                        </label>
                      </div>
                    </div>
                  </div>
                  <Button onClick={handleAddTemplate} disabled={uploadingTemplate || !newTemplateName.trim() || !frontFile || !backFile}>
                    <Plus className="h-4 w-4 mr-2" />
                    {uploadingTemplate ? 'Enviando...' : 'Adicionar Template'}
                  </Button>
                </div>
              </>
            )}
          </div>
        </TabsContent>

        {/* Stamps */}
        <TabsContent value="stamps">
          <div className="bg-card rounded-xl border border-border/50 shadow-sm p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Stamp className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h2 className="font-semibold font-display">Catálogo de Estampas</h2>
                <p className="text-sm text-muted-foreground">Gerencie as estampas disponíveis para os clientes no editor</p>
              </div>
            </div>

            {stampsLoading ? (
              <p className="text-sm text-muted-foreground">Carregando...</p>
            ) : (
              <>
                {stamps.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
                    {stamps.map(s => (
                      <div key={s.id} className="rounded-lg border border-border/50 bg-muted/20 overflow-hidden">
                        <div className="grid grid-cols-2 gap-1 p-2 bg-background">
                          <img src={s.imageUrl} alt={`${s.name} frente`} className="w-full aspect-[3/4] object-contain rounded" />
                          {s.backImageUrl ? (
                            <img src={s.backImageUrl} alt={`${s.name} costas`} className="w-full aspect-[3/4] object-contain rounded" />
                          ) : (
                            <div className="w-full aspect-[3/4] rounded bg-muted/30 flex items-center justify-center">
                              <span className="text-[10px] text-muted-foreground">Sem costas</span>
                            </div>
                          )}
                        </div>
                        <div className="px-3 py-2 flex items-center justify-between border-t border-border/30">
                          <div className="min-w-0">
                            <p className="text-xs font-medium truncate">{s.name}</p>
                            <p className="text-[10px] text-muted-foreground">{s.category}</p>
                          </div>
                          <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0" onClick={() => { if (confirm('Remover estampa?')) deleteStamp(s.id); }}>
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {stamps.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground mb-4">
                    <Stamp className="h-10 w-10 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">Nenhuma estampa cadastrada. Envie imagens para o catálogo.</p>
                  </div>
                )}

                <div className="space-y-3 border-t border-border/50 pt-4">
                  <p className="text-sm font-medium">Adicionar nova estampa</p>
                  <div className="flex gap-2">
                    <Input value={newStampName} onChange={e => setNewStampName(e.target.value)} placeholder="Nome da estampa" className="flex-1" />
                    <Input value={newStampCategory} onChange={e => setNewStampCategory(e.target.value)} placeholder="Categoria" className="w-32" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Imagem Frente *</label>
                      <div className="border border-dashed border-border rounded-lg p-3">
                        <label className="flex flex-col items-center gap-1 cursor-pointer text-center">
                          <Upload className="h-4 w-4 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">{stampFrontFile ? stampFrontFile.name : 'Selecionar'}</span>
                          <input ref={stampFrontRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={e => setStampFrontFile(e.target.files?.[0] ?? null)} className="hidden" />
                        </label>
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Imagem Costas *</label>
                      <div className="border border-dashed border-border rounded-lg p-3">
                        <label className="flex flex-col items-center gap-1 cursor-pointer text-center">
                          <Upload className="h-4 w-4 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">{stampBackFile ? stampBackFile.name : 'Selecionar'}</span>
                          <input ref={stampBackRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={e => setStampBackFile(e.target.files?.[0] ?? null)} className="hidden" />
                        </label>
                      </div>
                    </div>
                  </div>
                  <Button onClick={handleAddStamp} disabled={uploadingStamp || !newStampName.trim() || !stampFrontFile || !stampBackFile}>
                    <Plus className="h-4 w-4 mr-2" />
                    {uploadingStamp ? 'Enviando...' : 'Adicionar Estampa'}
                  </Button>
                </div>
              </>
            )}
          </div>
        </TabsContent>

        {/* Patches */}
        <TabsContent value="patches">
          <div className="bg-card rounded-xl border border-border/50 shadow-sm p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Fish className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h2 className="font-semibold font-display">Catálogo de Peixes</h2>
                <p className="text-sm text-muted-foreground">Cadastre os peixes da empresa e associe cada um a uma zona de aplicação</p>
              </div>
            </div>

            {patchesLoading ? (
              <p className="text-sm text-muted-foreground">Carregando...</p>
            ) : (
              <>
                {patches.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
                    {patches.map(p => (
                      <div key={p.id} className="rounded-lg border border-border/50 bg-muted/20 overflow-hidden">
                        <div className="p-2 bg-background">
                          <div
                            className="w-full aspect-square bg-center bg-contain bg-no-repeat rounded select-none"
                            style={{ backgroundImage: `url(${p.imageUrl})` }}
                            onContextMenu={e => e.preventDefault()}
                            draggable={false}
                          />
                        </div>
                        <div className="px-3 py-2 flex items-center justify-between border-t border-border/30">
                          <div className="min-w-0">
                            <p className="text-xs font-medium truncate">{p.name}</p>
                          </div>
                          <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0" onClick={() => { if (confirm('Remover peixe?')) deletePatch(p.id); }}>
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {patches.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground mb-4">
                    <Fish className="h-10 w-10 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">Nenhum peixe cadastrado. Adicione imagens de peixes da empresa.</p>
                  </div>
                )}

                <div className="space-y-3 border-t border-border/50 pt-4">
                  <p className="text-sm font-medium">Adicionar novo peixe</p>
                  <Input value={newPatchName} onChange={e => setNewPatchName(e.target.value)} placeholder="Nome do peixe (ex: Logo Empresa, Brasão)" />
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Imagem do Peixe *</label>
                    <div className="border border-dashed border-border rounded-lg p-3">
                      <label className="flex flex-col items-center gap-1 cursor-pointer text-center">
                        <Upload className="h-4 w-4 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">{patchFile ? patchFile.name : 'Selecionar'}</span>
                        <input ref={patchFileRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={e => setPatchFile(e.target.files?.[0] ?? null)} className="hidden" />
                      </label>
                    </div>
                  </div>
                  <p className="text-[10px] text-muted-foreground">O posicionamento será definido no editor ao selecionar o peixe</p>
                  <Button onClick={handleAddPatch} disabled={uploadingPatch || !newPatchName.trim() || !patchFile}>
                    <Plus className="h-4 w-4 mr-2" />
                    {uploadingPatch ? 'Enviando...' : 'Adicionar Peixe'}
                  </Button>
                </div>
              </>
            )}
          </div>
        </TabsContent>

        {/* WhatsApp */}
        <TabsContent value="whatsapp">
          <div className="bg-card rounded-xl border border-border/50 shadow-sm p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="h-10 w-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                <MessageCircle className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <h2 className="font-semibold font-display">WhatsApp para Orçamentos</h2>
                <p className="text-sm text-muted-foreground">Configure o número que receberá os pedidos de orçamento do editor de camisas</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-1.5 block">Número do WhatsApp</label>
                <Input
                  value={whatsappNumber}
                  onChange={e => setWhatsappNumber(e.target.value)}
                  placeholder="5511999999999 (código do país + DDD + número, sem espaços)"
                  disabled={whatsappLoading}
                />
                <p className="text-xs text-muted-foreground mt-1.5">
                  Digite apenas números, incluindo o código do país (55 para Brasil). Ex: 5511999999999
                </p>
              </div>

              {whatsappNumber && (
                <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
                  <p className="text-xs text-muted-foreground mb-1">Preview do link:</p>
                  <p className="text-sm font-mono text-primary break-all">
                    https://wa.me/{whatsappNumber.replace(/\D/g, '')}
                  </p>
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end">
              <Button onClick={handleSaveWhatsapp}>
                <Save className="h-4 w-4 mr-2" />
                Salvar WhatsApp
              </Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Zone Editor Modal */}
      {zoneEditorTemplate && (
        <ZoneEditor
          templateId={zoneEditorTemplate.id}
          frontImageUrl={zoneEditorTemplate.frontImageUrl}
          backImageUrl={zoneEditorTemplate.backImageUrl}
          onClose={() => setZoneEditorTemplate(null)}
        />
      )}
    </div>
  );
};

export default EditorSettings;
