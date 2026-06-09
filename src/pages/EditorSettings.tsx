import { useState, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Shirt, Stamp, Upload, Eye, EyeOff, MapPin, Sparkles, MessageCircle, Plus, Trash2, Save, Link, Copy, Check, Type, Tag, Pencil, ImageIcon, Box } from 'lucide-react';
import StampColorManager from '@/components/StampColorManager';
import { toast } from 'sonner';
import { useShirtTemplates } from '@/hooks/useShirtTemplates';
import { useStampCatalog } from '@/hooks/useStampCatalog';
import { usePatchCatalog } from '@/hooks/usePatchCatalog';
import { useTextStyles } from '@/hooks/useTextStyles';
import { useNiches } from '@/hooks/useNiches';
import { useUvLibrary } from '@/hooks/useUvLibrary';
import UvZoneAdminEditor from '@/components/UvZoneAdminEditor';
import ZoneEditor from '@/components/ZoneEditor';
import Zone3DEditor from '@/components/Zone3DEditor';

interface EditorSettingsProps {
  targetUserId?: string;
  targetEmail?: string;
}

const isLikelyStampCode = (name: string) => /^[A-Za-z]{0,6}[-_.]?\d{1,6}[A-Za-z]{0,3}$/i.test(name.trim());

const EditorSettings = ({ targetUserId, targetEmail }: EditorSettingsProps = {}) => {
  const { templates, loading: templatesLoading, addTemplate, deleteTemplate, toggleActive, updateTemplateUvMapId, fetchTemplates } = useShirtTemplates(targetUserId);
  const { stamps, loading: stampsLoading, addStamp, deleteStamp, updateStampUvMapId, updateStampTemplateId, fetchStamps } = useStampCatalog(targetUserId);
  const { patches, loading: patchesLoading, addPatch, deletePatch } = usePatchCatalog(targetUserId);
  const { niches, loading: nichesLoading, addNiche, updateNiche, deleteNiche, uploadCoverImage, uploadBackgroundImage } = useNiches(targetUserId);
  const { uvMaps, loading: uvLoading, addUvMap, updateUvMap: updateUvLib, updateUvZones, deleteUvMap, fetchUvMaps } = useUvLibrary(targetUserId);
  const [uvZoneEditorTarget, setUvZoneEditorTarget] = useState<string | null>(null);

  // UV Library form state
  const [newUvCode, setNewUvCode] = useState('');
  const [newUvName, setNewUvName] = useState('');
  const [newUvFile, setNewUvFile] = useState<File | null>(null);
  const newUvFileRef = useRef<HTMLInputElement>(null);
  const [uploadingUv, setUploadingUv] = useState(false);
  const [editingUvId, setEditingUvId] = useState<string | null>(null);
  const [editUvCode, setEditUvCode] = useState('');
  const [editUvName, setEditUvName] = useState('');

  const handleAddUv = async () => {
    if (!newUvCode.trim() || !newUvFile) { toast.error('Informe o código e selecione um arquivo'); return; }
    setUploadingUv(true);
    try {
      await addUvMap(newUvCode, newUvName || null, newUvFile);
      setNewUvCode(''); setNewUvName(''); setNewUvFile(null);
      if (newUvFileRef.current) newUvFileRef.current.value = '';
      toast.success('UV adicionado à biblioteca!');
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao salvar UV');
    }
    setUploadingUv(false);
  };

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
  const { styles: textStyles, loading: textStylesLoading, addStyle: addTextStyle, addMultipleStyles: addMultipleTextStyles, deleteStyle: deleteTextStyle } = useTextStyles(effectiveUserId);

  // Text style form
  const [newStyleCategory, setNewStyleCategory] = useState('Geral');
  const textStyleFileRef = useRef<HTMLInputElement>(null);
  const [textStyleFiles, setTextStyleFiles] = useState<File[]>([]);
  const [uploadingStyles, setUploadingStyles] = useState(false);

  const handleAddTextStyles = async () => {
    if (textStyleFiles.length === 0) { toast.error('Selecione ao menos uma imagem'); return; }
    setUploadingStyles(true);
    await addMultipleTextStyles(newStyleCategory.trim() || 'Geral', textStyleFiles);
    setNewStyleCategory('Geral'); setTextStyleFiles([]);
    if (textStyleFileRef.current) textStyleFileRef.current.value = '';
    setUploadingStyles(false);
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
  const [newTemplateUvMapId, setNewTemplateUvMapId] = useState<string>('none');
  const frontRef = useRef<HTMLInputElement>(null);
  const backRef = useRef<HTMLInputElement>(null);
  const [newTemplateUvFile, setNewTemplateUvFile] = useState<File | null>(null);
  const newTemplateUvRef = useRef<HTMLInputElement>(null);
  const [uploadingTemplate, setUploadingTemplate] = useState(false);
  const [zoneEditorUv, setZoneEditorUv] = useState<{ id: string; imageUrl: string; code: string } | null>(null);
  const [zone3dEditorTarget, setZone3dEditorTarget] = useState<{ templateId?: string; uvMapId?: string; label: string } | null>(null);

  // Inline matriz UV upload per template
  const matrizFileRef = useRef<HTMLInputElement>(null);
  const [matrizTargetTemplate, setMatrizTargetTemplate] = useState<typeof templates[number] | null>(null);
  const [uploadingMatriz, setUploadingMatriz] = useState(false);

  const triggerMatrizUpload = (template: typeof templates[number]) => {
    setMatrizTargetTemplate(template);
    setTimeout(() => matrizFileRef.current?.click(), 0);
  };

  const handleMatrizFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    const template = matrizTargetTemplate;
    setMatrizTargetTemplate(null);
    if (!file || !template || !effectiveUserId) return;
    setUploadingMatriz(true);
    try {
      const ts = Date.now();
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const path = `${effectiveUserId}/uv-library/${ts}_${safeName}`;
      const { error: upErr } = await supabase.storage.from('stamp-catalog').upload(path, file);
      if (upErr) throw upErr;
      const imageUrl = supabase.storage.from('stamp-catalog').getPublicUrl(path).data.publicUrl;
      const codeBase = template.name.replace(/\s+/g, '').slice(0, 8).toUpperCase() || 'TPL';
      const code = `MTZ-${codeBase}-${ts.toString().slice(-4)}`;
      const { data, error } = await supabase
        .from('uv_maps' as any)
        .insert({
          user_id: effectiveUserId,
          code,
          name: `Matriz ${template.name}`,
          image_url: imageUrl,
        } as any)
        .select()
        .single();
      if (error) throw error;
      const newUv = data as any;
      await updateTemplateUvMapId(template.id, newUv.id);
      await fetchUvMaps();
      setZoneEditorUv({ id: newUv.id, imageUrl: newUv.image_url, code: newUv.code });
      toast.success('Matriz importada! Edite as zonas compartilhadas.');
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || 'Erro ao importar matriz');
    }
    setUploadingMatriz(false);
  };

  const handleAddTemplate = async () => {
    if (!newTemplateName.trim()) {
      toast.error('Informe o nome do template');
      return;
    }
    const hasLibraryUv = newTemplateUvMapId && newTemplateUvMapId !== 'none';
    if (!newTemplateUvFile && !hasLibraryUv) {
      toast.error('Envie a imagem UV (matriz) do template ou selecione uma da biblioteca');
      return;
    }
    setUploadingTemplate(true);
    try {
      const name = newTemplateName.trim();
      const templateNicheId = newTemplateNicheId && newTemplateNicheId !== 'all' && newTemplateNicheId !== 'none' ? newTemplateNicheId : null;
      let uvMapId: string | null = hasLibraryUv ? newTemplateUvMapId : null;
      let uvImageUrl: string | null = null;

      // If user uploaded a UV file, create a uv_maps entry
      if (newTemplateUvFile && effectiveUserId) {
        const ts = Date.now();
        const safeName = newTemplateUvFile.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const path = `${effectiveUserId}/uv-library/${ts}_${safeName}`;
        const { error: upErr } = await supabase.storage.from('stamp-catalog').upload(path, newTemplateUvFile);
        if (upErr) throw upErr;
        uvImageUrl = supabase.storage.from('stamp-catalog').getPublicUrl(path).data.publicUrl;
        const codeBase = name.replace(/\s+/g, '').slice(0, 8).toUpperCase() || 'TPL';
        const code = `MTZ-${codeBase}-${ts.toString().slice(-4)}`;
        const { data: uvRow, error: uvErr } = await supabase
          .from('uv_maps' as any)
          .insert({ user_id: effectiveUserId, code, name: `Matriz ${name}`, image_url: uvImageUrl } as any)
          .select()
          .single();
        if (uvErr) throw uvErr;
        uvMapId = (uvRow as any).id;
        await fetchUvMaps();
      } else if (uvMapId) {
        const uv = uvMaps.find(u => u.id === uvMapId);
        uvImageUrl = uv?.imageUrl ?? null;
      }

      await addTemplate(name, frontFile, backFile, null, templateNicheId, uvMapId, uvImageUrl);
      toast.success('Template adicionado!');
      setNewTemplateName('');
      setNewTemplateNicheId('');
      setFrontFile(null);
      setBackFile(null);
      setNewTemplateUvMapId('none');
      setNewTemplateUvFile(null);
      if (frontRef.current) frontRef.current.value = '';
      if (backRef.current) backRef.current.value = '';
      if (newTemplateUvRef.current) newTemplateUvRef.current.value = '';
    } catch { toast.error('Erro ao adicionar template'); }
    setUploadingTemplate(false);
  };

  const moveTemplateToStamps = async (template: typeof templates[number]) => {
    if (!confirm(`Mover "${template.name}" para o Catálogo de Estampas?`)) return;
    if (!effectiveUserId) { toast.error('Usuário não identificado'); return; }
    try {
      const nicheId = templateNicheMap[template.id] || null;
      const nicheObj = niches.find(n => n.id === nicheId);
      const { error: insertError } = await supabase.from('stamp_catalog').insert({
        user_id: effectiveUserId,
        name: template.name,
        category: nicheObj?.name || 'Geral',
        image_url: template.frontImageUrl,
        back_image_url: template.backImageUrl,
        uv_map_url: template.uvMapUrl,
        niche_id: nicheId,
        active: true,
      } as any);
      if (insertError) throw insertError;
      await supabase.from('shirt_templates').update({ active: false } as any).eq('id', template.id);
      await Promise.all([fetchTemplates(), fetchStamps()]);
      toast.success('Movido para Estampas!');
    } catch (error) {
      console.error(error);
      toast.error('Erro ao mover para Estampas');
    }
  };

  // Stamps
  const [newStampName, setNewStampName] = useState('');
  const [newStampCodigo, setNewStampCodigo] = useState('');
  const [newStampNicheId, setNewStampNicheId] = useState<string>('');
  const [stampFrontFile, setStampFrontFile] = useState<File | null>(null);
  const [stampBackFile, setStampBackFile] = useState<File | null>(null);
  const [newStampUvMapId, setNewStampUvMapId] = useState<string>('none');
  const [newStampTemplateId, setNewStampTemplateId] = useState<string>('none');
  const stampFrontRef = useRef<HTMLInputElement>(null);
  const stampBackRef = useRef<HTMLInputElement>(null);
  const [uploadingStamp, setUploadingStamp] = useState(false);

  const handleAddStamp = async () => {
    if (!newStampName.trim() || !stampFrontFile || !newStampCodigo.trim()) {
      toast.error('Preencha o nome, código e envie a miniatura da estampa');
      return;
    }
    setUploadingStamp(true);
    try {
      const nicheObj = niches.find(n => n.id === newStampNicheId);
      const stampNicheId = newStampNicheId && newStampNicheId !== 'none' && newStampNicheId !== 'all' ? newStampNicheId : null;
      const uvMapId = newStampUvMapId && newStampUvMapId !== 'none' ? newStampUvMapId : null;
      const templateId = newStampTemplateId && newStampTemplateId !== 'none' ? newStampTemplateId : null;
      await addStamp(
        newStampName.trim(), 
        nicheObj?.name || 'Geral', 
        stampFrontFile, 
        stampBackFile, 
        null, 
        stampNicheId, 
        uvMapId, 
        templateId, 
        newStampCodigo.trim()
      );
      setNewStampName('');
      setNewStampCodigo('');
      setNewStampNicheId('');
      setStampFrontFile(null);
      setStampBackFile(null);
      setNewStampUvMapId('none');
      setNewStampTemplateId('none');
      if (stampFrontRef.current) stampFrontRef.current.value = '';
      if (stampBackRef.current) stampBackRef.current.value = '';
      toast.success('Estampa adicionada!');
    } catch (e: any) { 
      toast.error(e?.message || 'Erro ao adicionar estampa'); 
    }
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
          <TabsTrigger value="uvlib" className="gap-2">
            <Box className="h-4 w-4" />
            Biblioteca de UVs
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
                <p className="text-sm text-muted-foreground">Somente camisas em branco. Estampas prontas devem ser cadastradas na aba Estampas.</p>
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
                            <Select
                              value={t.uvMapId || 'none'}
                              onValueChange={async v => {
                                try {
                                  await updateTemplateUvMapId(t.id, v === 'none' ? null : v);
                                  toast.success('UV vinculado!');
                                } catch { toast.error('Erro ao vincular UV'); }
                              }}
                            >
                              <SelectTrigger className="h-7 w-24 text-[10px]">
                                <div className="flex items-center gap-1">
                                  <Box className={`h-3 w-3 ${t.uvMapId ? 'text-primary' : 'text-muted-foreground'}`} />
                                  <SelectValue placeholder="UV" />
                                </div>
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none" className="text-xs">Sem UV</SelectItem>
                                {uvMaps.map(u => (
                                  <SelectItem key={u.id} value={u.id} className="text-xs">{u.code}{u.name ? ` — ${u.name}` : ''}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => moveTemplateToStamps(t)} title="Mover para Estampas">
                              <Stamp className="h-3.5 w-3.5 text-primary" />
                            </Button>
                            {!t.uvMapId && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                title="Importar matriz UV (base p/ zonas compartilhadas)"
                                disabled={uploadingMatriz}
                                onClick={() => triggerMatrizUpload(t)}
                              >
                                <Upload className="h-3.5 w-3.5 text-primary" />
                              </Button>
                            )}
                            {t.uvMapId && (() => {
                              const uv = uvMaps.find(u => u.id === t.uvMapId);
                              if (!uv) return null;
                              return (
                                <>
                                  <Button variant="ghost" size="icon" className="h-7 w-7" title="Editar zonas 2D do UV vinculado" onClick={() => setZoneEditorUv({ id: uv.id, imageUrl: uv.imageUrl, code: uv.code })}>
                                    <MapPin className="h-3.5 w-3.5 text-primary" />
                                  </Button>
                                  <Button variant="ghost" size="icon" className="h-7 w-7" title="Definir zonas no 3D (decals)" onClick={() => setZone3dEditorTarget({ uvMapId: uv.id, label: uv.code })}>
                                    <Box className="h-3.5 w-3.5 text-amber-600" />
                                  </Button>
                                </>
                              );
                            })()}
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
                  <p className="text-xs text-muted-foreground">Envie a <strong>imagem UV (matriz)</strong> do molde — é nela que você marca as zonas (nome, números, logos). Frente e costas são apenas miniaturas opcionais.</p>
                  <div className="flex gap-2">
                    <Input value={newTemplateName} onChange={e => setNewTemplateName(e.target.value)} placeholder="Nome do modelo (ex: Gola O Manga Longa)" className="flex-1" />
                    <NicheSelector value={newTemplateNicheId || 'none'} onChange={v => setNewTemplateNicheId(v === 'none' ? '' : v)} label="Nicho" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block flex items-center gap-1">
                      <Box className="h-3 w-3" /> UV / Matriz do template *
                    </label>
                    <div className="border-2 border-dashed border-primary/40 rounded-lg p-4 bg-primary/5">
                      <label className="flex flex-col items-center gap-1 cursor-pointer text-center">
                        <Upload className="h-5 w-5 text-primary" />
                        <span className="text-xs font-medium">{newTemplateUvFile ? newTemplateUvFile.name : 'Selecionar imagem UV (matriz)'}</span>
                        <span className="text-[10px] text-muted-foreground">PNG/JPG/WEBP — será usado para marcar zonas compartilhadas</span>
                        <input ref={newTemplateUvRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={e => setNewTemplateUvFile(e.target.files?.[0] ?? null)} className="hidden" />
                      </label>
                    </div>
                    <div className="mt-2">
                      <label className="text-[10px] text-muted-foreground mb-1 block">ou escolha um UV já cadastrado na biblioteca</label>
                      <Select value={newTemplateUvMapId} onValueChange={setNewTemplateUvMapId}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Selecione um UV da biblioteca" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none" className="text-xs">— Nenhum —</SelectItem>
                          {uvMaps.map(u => (
                            <SelectItem key={u.id} value={u.id} className="text-xs">{u.code}{u.name ? ` — ${u.name}` : ''}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Miniatura Frente (opcional)</label>
                      <div className="border border-dashed border-border rounded-lg p-3">
                        <label className="flex flex-col items-center gap-1 cursor-pointer text-center">
                          <Upload className="h-4 w-4 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">{frontFile ? frontFile.name : 'Selecionar'}</span>
                          <input ref={frontRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={e => setFrontFile(e.target.files?.[0] ?? null)} className="hidden" />
                        </label>
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Miniatura Costas (opcional)</label>
                      <div className="border border-dashed border-border rounded-lg p-3">
                        <label className="flex flex-col items-center gap-1 cursor-pointer text-center">
                          <Upload className="h-4 w-4 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">{backFile ? backFile.name : 'Selecionar'}</span>
                          <input ref={backRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={e => setBackFile(e.target.files?.[0] ?? null)} className="hidden" />
                        </label>
                      </div>
                    </div>
                  </div>
                  <p className="text-[10px] text-muted-foreground">Depois de adicionar, use o botão <MapPin className="h-3 w-3 inline" /> no card do template para marcar as zonas (frente, costas, mangas, gola) sobre o UV. Todas as estampas vinculadas a este template compartilham as mesmas zonas.</p>
                  <Button onClick={handleAddTemplate} disabled={uploadingTemplate || !newTemplateName.trim() || (!newTemplateUvFile && (!newTemplateUvMapId || newTemplateUvMapId === 'none'))}>
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
                      <div key={s.id} className="relative rounded-lg border border-border/50 bg-muted/20 overflow-hidden">
                        <Button
                          variant="destructive"
                          size="icon"
                          className="absolute top-1 right-1 h-7 w-7 z-10 shadow-md"
                          onClick={() => { if (confirm(`Remover estampa "${s.name}"?`)) deleteStamp(s.id); }}
                          title="Remover estampa"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
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
                            <StampColorManager stampId={s.id} stampName={s.name} targetUserId={effectiveUserId} />
                            <Select
                              value={(s as any).templateId || 'none'}
                              onValueChange={async v => {
                                try {
                                  await updateStampTemplateId(s.id, v === 'none' ? null : v);
                                  toast.success('Template vinculado!');
                                } catch { toast.error('Erro ao vincular template'); }
                              }}
                            >
                              <SelectTrigger className="h-7 w-28 text-[10px] flex-shrink-0">
                                <div className="flex items-center gap-1">
                                  <Shirt className={`h-3 w-3 ${(s as any).templateId ? 'text-primary' : 'text-muted-foreground'}`} />
                                  <SelectValue placeholder="Template" />
                                </div>
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none" className="text-xs">Sem template</SelectItem>
                                {templates.map(t => (
                                  <SelectItem key={t.id} value={t.id} className="text-xs">
                                    {t.name}{t.uvMapId ? ' • UV ✓' : ''}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
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
                    <p className="text-xs text-muted-foreground">Frente e costas aparecem como miniatura 2D no editor final. O UV fica vinculado a esta estampa e troca o 3D quando o cliente clicar nela.</p>
                  <div className="flex gap-2">
                    <Input value={newStampName} onChange={e => setNewStampName(e.target.value)} placeholder="Nome da estampa" className="flex-1" />
                    <NicheSelector value={newStampNicheId || 'none'} onChange={v => setNewStampNicheId(v === 'none' ? '' : v)} label="Nicho" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">2D Frente / miniatura *</label>
                      <div className="border border-dashed border-border rounded-lg p-3">
                        <label className="flex flex-col items-center gap-1 cursor-pointer text-center">
                          <Upload className="h-4 w-4 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">{stampFrontFile ? stampFrontFile.name : 'Selecionar'}</span>
                          <input ref={stampFrontRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={e => setStampFrontFile(e.target.files?.[0] ?? null)} className="hidden" />
                        </label>
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">2D Costas *</label>
                      <div className="border border-dashed border-border rounded-lg p-3">
                        <label className="flex flex-col items-center gap-1 cursor-pointer text-center">
                          <Upload className="h-4 w-4 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">{stampBackFile ? stampBackFile.name : 'Selecionar'}</span>
                          <input ref={stampBackRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={e => setStampBackFile(e.target.files?.[0] ?? null)} className="hidden" />
                        </label>
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block flex items-center gap-1">
                      <Shirt className="h-3 w-3" /> Template (modelagem) vinculado *
                    </label>
                    <Select value={newStampTemplateId} onValueChange={setNewStampTemplateId}>
                      <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Selecione o template desta estampa" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none" className="text-xs">Sem template</SelectItem>
                        {templates.map(t => (
                          <SelectItem key={t.id} value={t.id} className="text-xs">
                            {t.name}{t.uvMapId ? ' • UV ✓' : ' • sem UV'}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-[10px] text-muted-foreground mt-1">Ao escolher esta estampa no editor, o 3D usa o UV e as zonas do template vinculado. Cadastre o UV matriz e marque as zonas pelo botão <MapPin className="h-3 w-3 inline" /> em "Camisas em Branco".</p>
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

        {/* UV Library */}
        <TabsContent value="uvlib">
          <div className="bg-card rounded-xl border border-border/50 shadow-sm p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Box className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h2 className="font-semibold font-display">Biblioteca de UVs</h2>
                <p className="text-sm text-muted-foreground">Faça upload dos mapas UV (frente, costas, mangas, gola...). Vincule um UV a cada molde na aba "Camisas em Branco" — as zonas são editadas pelo botão de zonas do molde e valem para todas as estampas daquele molde.</p>
              </div>
            </div>

            {/* Upload form */}
            <div className="space-y-3 mb-6 p-4 rounded-lg border border-border/50 bg-muted/20">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Código (ex: UV-001)</label>
                  <Input value={newUvCode} onChange={e => setNewUvCode(e.target.value)} placeholder="UV-001" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Nome (opcional)</label>
                  <Input value={newUvName} onChange={e => setNewUvName(e.target.value)} placeholder="Camisa Manga Curta" />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Imagem do UV map</label>
                <input
                  ref={newUvFileRef}
                  type="file"
                  accept="image/*"
                  onChange={e => setNewUvFile(e.target.files?.[0] ?? null)}
                  className="text-sm w-full"
                />
              </div>
              <Button onClick={handleAddUv} disabled={uploadingUv} className="w-full sm:w-auto">
                <Upload className="h-4 w-4 mr-2" />
                {uploadingUv ? 'Enviando...' : 'Adicionar UV à biblioteca'}
              </Button>
            </div>

            {uvLoading ? (
              <p className="text-sm text-muted-foreground text-center py-4">Carregando...</p>
            ) : uvMaps.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Nenhum UV cadastrado ainda</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {uvMaps.map(uv => {
                  const isEditing = editingUvId === uv.id;
                  return (
                    <div key={uv.id} className="rounded-lg border border-border/50 overflow-hidden bg-background">
                      <img src={uv.imageUrl} alt={uv.code} loading="lazy" className="w-full aspect-square object-contain p-2 bg-muted/20" />
                      <div className="p-3 space-y-2">
                        {isEditing ? (
                          <>
                            <Input value={editUvCode} onChange={e => setEditUvCode(e.target.value)} placeholder="Código" className="h-8 text-sm" />
                            <Input value={editUvName} onChange={e => setEditUvName(e.target.value)} placeholder="Nome" className="h-8 text-sm" />
                            <div className="flex gap-1">
                              <Button size="sm" className="flex-1 h-8 text-xs" onClick={async () => {
                                try {
                                  await updateUvLib(uv.id, { code: editUvCode, name: editUvName });
                                  setEditingUvId(null);
                                  toast.success('UV atualizado');
                                } catch (e: any) { toast.error(e?.message || 'Erro'); }
                              }}>
                                <Save className="h-3 w-3 mr-1" /> Salvar
                              </Button>
                              <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setEditingUvId(null)}>Cancelar</Button>
                            </div>
                          </>
                        ) : (
                          <>
                            <div>
                              <p className="text-sm font-semibold truncate">{uv.code}</p>
                              {uv.name && <p className="text-xs text-muted-foreground truncate">{uv.name}</p>}
                            </div>
                            <div className="flex gap-1">
                              <Button size="sm" variant="outline" className="flex-1 h-8 text-xs" onClick={() => { setEditingUvId(uv.id); setEditUvCode(uv.code); setEditUvName(uv.name ?? ''); }}>
                                <Pencil className="h-3.5 w-3.5" />
                                <span className="ml-1">Editar</span>
                              </Button>
                              <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setUvZoneEditorTarget(uv.id)} title="Definir zonas UV">
                                <MapPin className="h-3.5 w-3.5" />
                                <span className="ml-1">Zonas</span>
                              </Button>
                              <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-destructive" onClick={async () => {
                                if (!confirm(`Excluir UV ${uv.code}? As zonas associadas também serão removidas.`)) return;
                                try { await deleteUvMap(uv.id); toast.success('UV removido'); }
                                catch (e: any) { toast.error(e?.message || 'Erro'); }
                              }}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
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

            {/* Add new styles - multi-file */}
            <div className="space-y-3 mb-6 p-4 rounded-lg border border-border/50 bg-muted/20">
              <p className="text-sm font-medium">Importar estilos de texto</p>
              <Input value={newStyleCategory} onChange={e => setNewStyleCategory(e.target.value)} placeholder="Categoria (ex: Nomes, Frases)" />
              <div className="border border-dashed border-border rounded-lg p-4">
                <label className="flex flex-col items-center gap-2 cursor-pointer text-center">
                  <Upload className="h-5 w-5 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">
                    {textStyleFiles.length > 0
                      ? `${textStyleFiles.length} arquivo(s) selecionado(s)`
                      : 'Clique para selecionar imagens (múltiplas)'}
                  </span>
                  <input
                    ref={textStyleFileRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    multiple
                    onChange={e => setTextStyleFiles(e.target.files ? Array.from(e.target.files) : [])}
                    className="hidden"
                  />
                </label>
              </div>
              {textStyleFiles.length > 0 && (
                <p className="text-[10px] text-muted-foreground">
                  📝 O nome de cada arquivo será usado como nome do estilo. Você pode renomear depois.
                </p>
              )}
              <Button onClick={handleAddTextStyles} disabled={uploadingStyles || textStyleFiles.length === 0} className="w-full">
                <Plus className="h-4 w-4 mr-2" />
                {uploadingStyles ? 'Enviando...' : `Importar ${textStyleFiles.length > 0 ? textStyleFiles.length + ' estilo(s)' : 'Estilos'}`}
              </Button>
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
      {zoneEditorUv && (
        <ZoneEditor
          uvMapId={zoneEditorUv.id}
          uvImageUrl={zoneEditorUv.imageUrl}
          onClose={() => setZoneEditorUv(null)}
        />
      )}

      {/* Zone 3D Editor Modal */}
      {zone3dEditorTarget && (
        <Zone3DEditor
          templateId={zone3dEditorTarget.templateId}
          uvMapId={zone3dEditorTarget.uvMapId}
          onClose={() => setZone3dEditorTarget(null)}
        />
      )}

      {/* Hidden file input for inline matriz upload */}
      <input
        ref={matrizFileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={handleMatrizFileChange}
      />

      {uvZoneEditorTarget && (() => {
        const uv = uvMaps.find(u => u.id === uvZoneEditorTarget);
        if (!uv) return null;
        return (
          <UvZoneAdminEditor
            open={true}
            onOpenChange={(o) => { if (!o) setUvZoneEditorTarget(null); }}
            imageUrl={uv.imageUrl}
            code={uv.code}
            initialZones={uv.uvZones}
            initialWidth={uv.uvWidth}
            initialHeight={uv.uvHeight}
            onSave={async (zones, dims) => { await updateUvZones(uv.id, zones, dims); }}
          />
        );
      })()}
    </div>
  );
};

export default EditorSettings;
