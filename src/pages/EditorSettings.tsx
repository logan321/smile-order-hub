import { useState, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Shirt, Stamp, Upload, Eye, EyeOff, MapPin, Sparkles, MessageCircle, Plus, Trash2, Save, Link, Copy, Check, Type, Tag, Pencil, ImageIcon } from 'lucide-react';
import { toast } from 'sonner';
import { useShirtTemplates } from '@/hooks/useShirtTemplates';
import { useStampCatalog } from '@/hooks/useStampCatalog';
import { usePatchCatalog } from '@/hooks/usePatchCatalog';
import { useTextStyles } from '@/hooks/useTextStyles';
import { useNiches } from '@/hooks/useNiches';
import ZoneEditor from '@/components/ZoneEditor';

interface EditorSettingsProps {
  targetUserId?: string;
  targetEmail?: string;
}

const EditorSettings = ({ targetUserId, targetEmail }: EditorSettingsProps = {}) => {
  const { templates, loading: templatesLoading, addTemplate, deleteTemplate, toggleActive } = useShirtTemplates(targetUserId);
  const { stamps, loading: stampsLoading, addStamp, deleteStamp } = useStampCatalog(targetUserId);
  const { patches, loading: patchesLoading, addPatch, deletePatch } = usePatchCatalog(targetUserId);
  const { niches, loading: nichesLoading, addNiche, updateNiche, deleteNiche, uploadCoverImage, uploadBackgroundImage } = useNiches(targetUserId);

  // Public editor link
  const [editorUserId, setEditorUserId] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);

  useEffect(() => {
    if (targetUserId) {
      setEditorUserId(targetUserId);
    } else {
      supabase.auth.getSession().then(({ data: { session } }) => {
        setEditorUserId(session?.user?.id ?? null);
      });
    }
  }, [targetUserId]);

  const effectiveUserId = targetUserId || editorUserId || undefined;
  const { styles: textStyles, loading: textStylesLoading, addStyle: addTextStyle, deleteStyle: deleteTextStyle } = useTextStyles(effectiveUserId);

  // Text style form
  const [newStyleName, setNewStyleName] = useState('');
  const [newStyleCategory, setNewStyleCategory] = useState('Geral');
  const textStyleFileRef = useRef<HTMLInputElement>(null);
  const [textStyleFile, setTextStyleFile] = useState<File | null>(null);

  const handleAddTextStyle = async () => {
    if (!newStyleName.trim() || !textStyleFile) { toast.error('Nome e imagem são obrigatórios'); return; }
    await addTextStyle(newStyleName.trim(), newStyleCategory.trim() || 'Geral', textStyleFile);
    setNewStyleName(''); setNewStyleCategory('Geral'); setTextStyleFile(null);
    if (textStyleFileRef.current) textStyleFileRef.current.value = '';
  };

  const publicEditorLink = editorUserId
    ? `${window.location.origin}/editor/${editorUserId}`
    : '';

  const handleCopyLink = () => {
    navigator.clipboard.writeText(publicEditorLink);
    setLinkCopied(true);
    toast.success('Link copiado!');
    setTimeout(() => setLinkCopied(false), 2000);
  };

  // WhatsApp
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [whatsappLoading, setWhatsappLoading] = useState(true);

  useEffect(() => {
    const loadWhatsapp = async () => {
      const userId = targetUserId || (await supabase.auth.getSession()).data.session?.user?.id;
      if (!userId) { setWhatsappLoading(false); return; }
      const { data } = await supabase.from('user_settings').select('whatsapp_number').eq('user_id', userId).maybeSingle();
      if (data) setWhatsappNumber(data.whatsapp_number);
      setWhatsappLoading(false);
    };
    loadWhatsapp();
  }, [targetUserId]);

  const handleSaveWhatsapp = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) { toast.error('Faça login primeiro'); return; }
    const userId = targetUserId || session.user.id;
    const { error } = await supabase.from('user_settings').upsert({
      user_id: userId,
      whatsapp_number: whatsappNumber.replace(/\D/g, ''),
    }, { onConflict: 'user_id' });
    if (error) { toast.error('Erro ao salvar'); console.error(error); return; }
    toast.success('WhatsApp salvo!');
  };

  // Templates
  const [newTemplateName, setNewTemplateName] = useState('');
  const [newTemplateNicheId, setNewTemplateNicheId] = useState<string>('');
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
      // Update niche_id if selected
      if (newTemplateNicheId && newTemplateNicheId !== 'all') {
        const { data: latestTemplates } = await supabase.from('shirt_templates').select('id').order('created_at', { ascending: false }).limit(1);
        if (latestTemplates?.[0]) {
          await supabase.from('shirt_templates').update({ niche_id: newTemplateNicheId } as any).eq('id', latestTemplates[0].id);
        }
      }
      setNewTemplateName('');
      setNewTemplateNicheId('');
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
  const [newStampNicheId, setNewStampNicheId] = useState<string>('');
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
      const nicheObj = niches.find(n => n.id === newStampNicheId);
      await addStamp(newStampName.trim(), nicheObj?.name || 'Geral', stampFrontFile, stampBackFile);
      // Update niche_id
      if (newStampNicheId) {
        const { data: latestStamps } = await supabase.from('stamp_catalog').select('id').order('created_at', { ascending: false }).limit(1);
        if (latestStamps?.[0]) {
          await supabase.from('stamp_catalog').update({ niche_id: newStampNicheId } as any).eq('id', latestStamps[0].id);
        }
      }
      setNewStampName('');
      setNewStampNicheId('');
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
  const [newPatchNicheId, setNewPatchNicheId] = useState<string>('');
  const [patchFile, setPatchFile] = useState<File | null>(null);
  const patchFileRef = useRef<HTMLInputElement>(null);
  const [uploadingPatch, setUploadingPatch] = useState(false);

  const handleAddPatch = async () => {
    if (!newPatchName.trim() || !patchFile) {
      toast.error('Preencha o nome e envie a imagem');
      return;
    }
    setUploadingPatch(true);
    try {
      await addPatch(newPatchName.trim(), patchFile);
      if (newPatchNicheId) {
        const { data: latestPatches } = await supabase.from('patch_catalog').select('id').order('created_at', { ascending: false }).limit(1);
        if (latestPatches?.[0]) {
          await supabase.from('patch_catalog').update({ niche_id: newPatchNicheId } as any).eq('id', latestPatches[0].id);
        }
      }
      setNewPatchName('');
      setNewPatchNicheId('');
      setPatchFile(null);
      if (patchFileRef.current) patchFileRef.current.value = '';
      toast.success('Emblema adicionado!');
    } catch { toast.error('Erro ao adicionar emblema'); }
    setUploadingPatch(false);
  };

  // Niches form
  const [newNicheName, setNewNicheName] = useState('');
  const [newNicheIcon, setNewNicheIcon] = useState('🏷️');
  const [newNichePatchLabel, setNewNichePatchLabel] = useState('Emblemas');
  const [editingNiche, setEditingNiche] = useState<string | null>(null);
  const [editNicheName, setEditNicheName] = useState('');
  const [editNicheIcon, setEditNicheIcon] = useState('');
  const [editNichePatchLabel, setEditNichePatchLabel] = useState('');

  const handleAddNiche = async () => {
    if (!newNicheName.trim()) { toast.error('Nome do nicho é obrigatório'); return; }
    await addNiche(newNicheName.trim(), newNicheIcon || '🏷️', newNichePatchLabel.trim() || 'Emblemas');
    setNewNicheName(''); setNewNicheIcon('🏷️'); setNewNichePatchLabel('Emblemas');
    toast.success('Nicho adicionado!');
  };

  const startEditNiche = (n: typeof niches[0]) => {
    setEditingNiche(n.id);
    setEditNicheName(n.name);
    setEditNicheIcon(n.icon);
    setEditNichePatchLabel(n.patchLabel);
  };

  const saveEditNiche = async () => {
    if (!editingNiche) return;
    await updateNiche(editingNiche, { name: editNicheName, icon: editNicheIcon, patchLabel: editNichePatchLabel });
    setEditingNiche(null);
    toast.success('Nicho atualizado!');
  };

  // Helper: get niche name by id (for display on assets)
  const getNicheName = (nicheId: string | null | undefined, table?: string) => {
    if (!nicheId && table === 'shirt_templates') return '🌐 Todos os Nichos';
    if (!nicheId) return null;
    const n = niches.find(x => x.id === nicheId);
    return n ? `${n.icon} ${n.name}` : null;
  };

  // Helper: niche selector component
  const NicheSelector = ({ value, onChange, label }: { value: string; onChange: (v: string) => void; label?: string }) => (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-9 text-xs">
        <SelectValue placeholder={label || 'Selecione o nicho'} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="none">Sem nicho</SelectItem>
        <SelectItem value="all">🌐 Todos os Nichos</SelectItem>
        {niches.map(n => (
          <SelectItem key={n.id} value={n.id}>{n.icon} {n.name}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  // Get niche info from assets (requires fetching niche_id from raw data)
  // For display, we'll use a simple mapping approach
  const [templateNicheMap, setTemplateNicheMap] = useState<Record<string, string | null>>({});
  const [stampNicheMap, setStampNicheMap] = useState<Record<string, string | null>>({});
  const [patchNicheMap, setPatchNicheMap] = useState<Record<string, string | null>>({});

  useEffect(() => {
    const loadNicheMaps = async () => {
      const userId = targetUserId || (await supabase.auth.getSession()).data.session?.user?.id;
      if (!userId) return;
      const [t, s, p] = await Promise.all([
        supabase.from('shirt_templates').select('id, niche_id').eq('user_id', userId),
        supabase.from('stamp_catalog').select('id, niche_id').eq('user_id', userId),
        supabase.from('patch_catalog').select('id, niche_id').eq('user_id', userId),
      ]);
      const tMap: Record<string, string | null> = {};
      (t.data as any[])?.forEach(r => { tMap[r.id] = r.niche_id; });
      setTemplateNicheMap(tMap);
      const sMap: Record<string, string | null> = {};
      (s.data as any[])?.forEach(r => { sMap[r.id] = r.niche_id; });
      setStampNicheMap(sMap);
      const pMap: Record<string, string | null> = {};
      (p.data as any[])?.forEach(r => { pMap[r.id] = r.niche_id; });
      setPatchNicheMap(pMap);
    };
    loadNicheMaps();
  }, [targetUserId, templates, stamps, patches]);

  const updateAssetNiche = async (table: 'shirt_templates' | 'stamp_catalog' | 'patch_catalog', id: string, nicheId: string | null | 'all') => {
    const dbValue = nicheId === 'all' ? null : nicheId;
    await (supabase.from(table).update({ niche_id: dbValue } as any).eq('id', id) as any);
    // Refresh maps
    if (table === 'shirt_templates') setTemplateNicheMap(prev => ({ ...prev, [id]: nicheId }));
    if (table === 'stamp_catalog') setStampNicheMap(prev => ({ ...prev, [id]: nicheId }));
    if (table === 'patch_catalog') setPatchNicheMap(prev => ({ ...prev, [id]: nicheId }));
    toast.success('Nicho atualizado!');
  };

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <h1 className="page-title">
          {targetUserId ? `Editor de: ${targetEmail || 'Cliente'}` : 'Configurações do Editor'}
        </h1>
        <p className="page-description">
          {targetUserId
            ? 'Gerenciando nichos, templates, estampas, emblemas e WhatsApp deste cliente'
            : 'Gerencie nichos, templates, estampas, emblemas e WhatsApp do seu editor de camisas'}
        </p>
      </div>

      {/* Public editor link card */}
      {publicEditorLink && (
        <div className="max-w-3xl mb-6 bg-card rounded-xl border border-border/50 shadow-sm p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-9 w-9 rounded-lg bg-accent/20 flex items-center justify-center">
              <Link className="h-4 w-4 text-accent" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold">Link público do seu editor</h3>
              <p className="text-xs text-muted-foreground">Compartilhe este link com seus clientes para personalizarem camisas</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Input value={publicEditorLink} readOnly className="text-xs bg-muted/30 flex-1" />
            <Button size="sm" variant="outline" className="gap-1.5 shrink-0" onClick={handleCopyLink}>
              {linkCopied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
              {linkCopied ? 'Copiado!' : 'Copiar'}
            </Button>
          </div>
        </div>
      )}

      <Tabs defaultValue="niches" className="max-w-3xl">
        <TabsList className="mb-6 flex-wrap h-auto gap-1">
          <TabsTrigger value="niches" className="gap-2">
            <Tag className="h-4 w-4" />
            Nichos
          </TabsTrigger>
          <TabsTrigger value="templates" className="gap-2">
            <Shirt className="h-4 w-4" />
            Templates
          </TabsTrigger>
          <TabsTrigger value="stamps" className="gap-2">
            <Stamp className="h-4 w-4" />
            Estampas
          </TabsTrigger>
          <TabsTrigger value="patches" className="gap-2">
            <Sparkles className="h-4 w-4" />
            Emblemas
          </TabsTrigger>
          <TabsTrigger value="textstyles" className="gap-2">
            <Type className="h-4 w-4" />
            Estilos de Texto
          </TabsTrigger>
          <TabsTrigger value="whatsapp" className="gap-2">
            <MessageCircle className="h-4 w-4" />
            WhatsApp
          </TabsTrigger>
        </TabsList>

        {/* Niches */}
        <TabsContent value="niches">
          <div className="bg-card rounded-xl border border-border/50 shadow-sm p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Tag className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h2 className="font-semibold font-display">Nichos de Mercado</h2>
                <p className="text-sm text-muted-foreground">Crie nichos para organizar seus templates, estampas e emblemas por segmento</p>
              </div>
            </div>

            {nichesLoading ? (
              <p className="text-sm text-muted-foreground">Carregando...</p>
            ) : (
              <>
                {niches.length > 0 && (
                  <div className="space-y-2 mb-6">
                    {niches.map(n => (
                      <div key={n.id} className="flex items-center gap-3 p-3 rounded-lg border border-border/50 bg-muted/20">
                        {editingNiche === n.id ? (
                          <>
                            <Input value={editNicheIcon} onChange={e => setEditNicheIcon(e.target.value)} className="w-14 h-8 text-center text-lg" />
                            <Input value={editNicheName} onChange={e => setEditNicheName(e.target.value)} className="flex-1 h-8 text-sm" />
                            <Input value={editNichePatchLabel} onChange={e => setEditNichePatchLabel(e.target.value)} className="w-28 h-8 text-xs" placeholder="Nome dos emblemas" />
                            <Button size="sm" variant="outline" className="h-8" onClick={saveEditNiche}><Check className="h-3.5 w-3.5" /></Button>
                            <Button size="sm" variant="ghost" className="h-8" onClick={() => setEditingNiche(null)}>Cancelar</Button>
                          </>
                        ) : (
                          <>
                            {n.coverImageUrl ? (
                              <img src={n.coverImageUrl} alt={n.name} className="h-12 w-10 object-contain rounded" />
                            ) : (
                              <span className="text-2xl">{n.icon}</span>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold">{n.name}</p>
                              <p className="text-[10px] text-muted-foreground">Emblemas: "{n.patchLabel}"</p>
                              {n.backgroundImageUrl && <p className="text-[10px] text-green-600">✓ Background definido</p>}
                            </div>
                            <label className="cursor-pointer" title="Imagem de capa">
                              <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                try {
                                  await uploadCoverImage(n.id, file);
                                  toast.success('Imagem de capa atualizada!');
                                } catch { toast.error('Erro ao enviar imagem'); }
                                e.target.value = '';
                              }} />
                              <div className="h-7 w-7 rounded flex items-center justify-center hover:bg-muted transition-colors" title="Imagem de capa">
                                <Upload className="h-3.5 w-3.5 text-muted-foreground" />
                              </div>
                            </label>
                            <label className="cursor-pointer" title="Background do editor">
                              <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                try {
                                  await uploadBackgroundImage(n.id, file);
                                  toast.success('Background do editor atualizado!');
                                } catch { toast.error('Erro ao enviar background'); }
                                e.target.value = '';
                              }} />
                              <div className="h-7 w-7 rounded flex items-center justify-center hover:bg-muted transition-colors" title="Background do editor">
                                <ImageIcon className="h-3.5 w-3.5 text-muted-foreground" />
                              </div>
                            </label>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => startEditNiche(n)}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { if (confirm(`Remover nicho "${n.name}"?`)) deleteNiche(n.id); }}>
                              <Trash2 className="h-3.5 w-3.5 text-destructive" />
                            </Button>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {niches.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground mb-4">
                    <Tag className="h-10 w-10 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">Nenhum nicho cadastrado. Crie nichos como PESCA, AGRO, ESPORTE, etc.</p>
                  </div>
                )}

                <div className="space-y-3 border-t border-border/50 pt-4">
                  <p className="text-sm font-medium">Adicionar novo nicho</p>
                  <div className="flex gap-2">
                    <Input value={newNicheIcon} onChange={e => setNewNicheIcon(e.target.value)} placeholder="🎣" className="w-14 text-center text-lg" />
                    <Input value={newNicheName} onChange={e => setNewNicheName(e.target.value)} placeholder="Nome do nicho (ex: PESCA)" className="flex-1" />
                    <Input value={newNichePatchLabel} onChange={e => setNewNichePatchLabel(e.target.value)} placeholder="Nome dos emblemas (ex: Peixes)" className="w-36" />
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    O "Nome dos emblemas" define como a categoria de emblemas será chamada neste nicho. Ex: PESCA → "Peixes", AGRO → "Maquinários"
                  </p>
                  <Button onClick={handleAddNiche} disabled={!newNicheName.trim()}>
                    <Plus className="h-4 w-4 mr-2" />
                    Adicionar Nicho
                  </Button>
                </div>
              </>
            )}
          </div>
        </TabsContent>

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
                          <div className="min-w-0">
                            <span className="text-sm font-medium">{t.name}</span>
                            {(() => { const label = getNicheName(templateNicheMap[t.id], 'shirt_templates'); return label ? <p className="text-[10px] text-muted-foreground">{label}</p> : null; })()}
                          </div>
                          <div className="flex items-center gap-1">
                            <Select value={templateNicheMap[t.id] || 'all'} onValueChange={v => updateAssetNiche('shirt_templates', t.id, v)}>
                              <SelectTrigger className="h-7 w-28 text-[10px]"><SelectValue placeholder="Nicho" /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="all" className="text-xs">🌐 Todos</SelectItem>
                                {niches.map(n => <SelectItem key={n.id} value={n.id} className="text-xs">{n.icon} {n.name}</SelectItem>)}
                              </SelectContent>
                            </Select>
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
                  <div className="flex gap-2">
                    <Input value={newTemplateName} onChange={e => setNewTemplateName(e.target.value)} placeholder="Nome do modelo (ex: Gola O Manga Longa)" className="flex-1" />
                    <NicheSelector value={newTemplateNicheId || 'none'} onChange={v => setNewTemplateNicheId(v === 'none' ? '' : v)} label="Nicho" />
                  </div>
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
                            {getNicheName(stampNicheMap[s.id]) && (
                              <p className="text-[10px] text-muted-foreground">{getNicheName(stampNicheMap[s.id])}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            <Select value={stampNicheMap[s.id] || 'none'} onValueChange={v => updateAssetNiche('stamp_catalog', s.id, v === 'none' ? null : v)}>
                              <SelectTrigger className="h-7 w-20 text-[10px]"><SelectValue placeholder="Nicho" /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none" className="text-xs">Sem</SelectItem>
                                {niches.map(n => <SelectItem key={n.id} value={n.id} className="text-xs">{n.icon} {n.name}</SelectItem>)}
                              </SelectContent>
                            </Select>
                            <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0" onClick={() => { if (confirm('Remover estampa?')) deleteStamp(s.id); }}>
                              <Trash2 className="h-3.5 w-3.5 text-destructive" />
                            </Button>
                          </div>
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
                    <NicheSelector value={newStampNicheId || 'none'} onChange={v => setNewStampNicheId(v === 'none' ? '' : v)} label="Nicho" />
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

        {/* Patches (Emblemas) */}
        <TabsContent value="patches">
          <div className="bg-card rounded-xl border border-border/50 shadow-sm p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Sparkles className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h2 className="font-semibold font-display">Catálogo de Emblemas</h2>
                <p className="text-sm text-muted-foreground">Cadastre os emblemas de cada nicho e associe a uma zona de aplicação</p>
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
                            {getNicheName(patchNicheMap[p.id]) && (
                              <p className="text-[10px] text-muted-foreground">{getNicheName(patchNicheMap[p.id])}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            <Select value={patchNicheMap[p.id] || 'none'} onValueChange={v => updateAssetNiche('patch_catalog', p.id, v === 'none' ? null : v)}>
                              <SelectTrigger className="h-7 w-20 text-[10px]"><SelectValue placeholder="Nicho" /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none" className="text-xs">Sem</SelectItem>
                                {niches.map(n => <SelectItem key={n.id} value={n.id} className="text-xs">{n.icon} {n.name}</SelectItem>)}
                              </SelectContent>
                            </Select>
                            <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0" onClick={() => { if (confirm('Remover emblema?')) deletePatch(p.id); }}>
                              <Trash2 className="h-3.5 w-3.5 text-destructive" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {patches.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground mb-4">
                    <Sparkles className="h-10 w-10 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">Nenhum emblema cadastrado. Adicione imagens de emblemas para cada nicho.</p>
                  </div>
                )}

                <div className="space-y-3 border-t border-border/50 pt-4">
                  <p className="text-sm font-medium">Adicionar novo emblema</p>
                  <div className="flex gap-2">
                    <Input value={newPatchName} onChange={e => setNewPatchName(e.target.value)} placeholder="Nome do emblema (ex: Logo Empresa, Trator)" className="flex-1" />
                    <NicheSelector value={newPatchNicheId || 'none'} onChange={v => setNewPatchNicheId(v === 'none' ? '' : v)} label="Nicho" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Imagem do Emblema *</label>
                    <div className="border border-dashed border-border rounded-lg p-3">
                      <label className="flex flex-col items-center gap-1 cursor-pointer text-center">
                        <Upload className="h-4 w-4 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">{patchFile ? patchFile.name : 'Selecionar'}</span>
                        <input ref={patchFileRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={e => setPatchFile(e.target.files?.[0] ?? null)} className="hidden" />
                      </label>
                    </div>
                  </div>
                  <p className="text-[10px] text-muted-foreground">O posicionamento será definido no editor ao selecionar o emblema</p>
                  <Button onClick={handleAddPatch} disabled={uploadingPatch || !newPatchName.trim() || !patchFile}>
                    <Plus className="h-4 w-4 mr-2" />
                    {uploadingPatch ? 'Enviando...' : 'Adicionar Emblema'}
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

        {/* Text Styles */}
        <TabsContent value="textstyles">
          <div className="bg-card rounded-xl border border-border/50 shadow-sm p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="h-10 w-10 rounded-lg bg-accent/20 flex items-center justify-center">
                <Type className="h-5 w-5 text-accent" />
              </div>
              <div>
                <h2 className="font-semibold font-display">Estilos de Texto</h2>
                <p className="text-sm text-muted-foreground">Cadastre modelos de texto estilizado (imagens PNG) para seus clientes usarem</p>
              </div>
            </div>

            {/* Add new style */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6 p-4 rounded-lg border border-border/50 bg-muted/20">
              <Input value={newStyleName} onChange={e => setNewStyleName(e.target.value)} placeholder="Nome do estilo" />
              <Input value={newStyleCategory} onChange={e => setNewStyleCategory(e.target.value)} placeholder="Categoria (ex: Nomes, Frases)" />
              <div className="flex gap-2">
                <input ref={textStyleFileRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={e => setTextStyleFile(e.target.files?.[0] || null)} className="text-xs file:mr-2 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-primary/10 file:text-primary w-full" />
                <Button size="sm" onClick={handleAddTextStyle} disabled={!newStyleName.trim() || !textStyleFile} className="shrink-0">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <p className="text-xs text-muted-foreground mb-4">
              💡 Dica: Crie imagens PNG com fundo transparente mostrando textos estilizados (ex: "NOME TIME" com fonte decorada, sombra, gradiente). O cliente verá essas opções no editor e poderá aplicar como imagem na camisa.
            </p>

            {textStylesLoading ? (
              <p className="text-sm text-muted-foreground text-center py-4">Carregando...</p>
            ) : textStyles.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Nenhum estilo de texto cadastrado ainda</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {textStyles.map(style => (
                  <div key={style.id} className="rounded-lg border border-border/50 overflow-hidden bg-background group">
                    <img src={style.imageUrl} alt={style.name} className="w-full aspect-video object-contain p-2 bg-muted/20" />
                    <div className="p-2 flex items-center justify-between">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold truncate">{style.name}</p>
                        <p className="text-[10px] text-muted-foreground">{style.category}</p>
                      </div>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => deleteTextStyle(style.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
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
