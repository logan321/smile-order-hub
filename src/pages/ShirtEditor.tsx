import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useShirtTemplates } from '@/hooks/useShirtTemplates';
import { useUvLibrary, UvZone } from '@/hooks/useUvLibrary';
import { useUvCompositor } from '@/hooks/useUvCompositor';
import { UvLayer } from '@/lib/uvCompositor';
import Shirt3DPreview from '@/components/Shirt3DPreview';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import {
  Shirt, Palette, Type, Award, Upload, Save, Send, X, Plus, Trash2,
} from 'lucide-react';

interface Props { useOwnAssets?: boolean }

type TabId = 'modelo' | 'cores' | 'nome' | 'emblemas' | 'upload';

const TABS: { id: TabId; label: string; icon: any }[] = [
  { id: 'modelo',   label: 'Modelo',   icon: Shirt },
  { id: 'cores',    label: 'Cores',    icon: Palette },
  { id: 'nome',     label: 'Nome',     icon: Type },
  { id: 'emblemas', label: 'Emblemas', icon: Award },
  { id: 'upload',   label: 'Upload',   icon: Upload },
];

const PRESET_COLORS = [
  '#ffffff','#0f172a','#1e3a8a','#dc2626','#f59e0b','#16a34a',
  '#0ea5e9','#a21caf','#ec4899','#64748b','#000000','#fef3c7',
];

interface Emblem { id: string; name: string; image_url: string; category: string | null }

export default function ShirtEditor({ useOwnAssets }: Props = {}) {
  const params = useParams();
  const targetUserId = useOwnAssets ? undefined : params.userId;

  const { templates, loading: loadingTpl } = useShirtTemplates(targetUserId);
  const { uvMaps } = useUvLibrary(targetUserId);

  const activeTemplates = useMemo(() => templates.filter(t => t.active), [templates]);
  const [templateId, setTemplateId] = useState<string | null>(null);
  useEffect(() => {
    if (!templateId && activeTemplates.length) setTemplateId(activeTemplates[0].id);
  }, [activeTemplates, templateId]);

  const template = useMemo(() => activeTemplates.find(t => t.id === templateId) ?? null, [activeTemplates, templateId]);
  const uvMap = useMemo(() => uvMaps.find(m => m.id === template?.uvMapId) ?? null, [uvMaps, template]);
  const zones: Record<string, UvZone> = uvMap?.uvZones ?? {};
  const zoneKeys = Object.keys(zones);

  const [fabricColor, setFabricColor] = useState('#ffffff');
  const [layers, setLayers] = useState<UvLayer[]>([]);
  const [activeTab, setActiveTab] = useState<TabId>('modelo');
  const [panelOpen, setPanelOpen] = useState(true);

  // Composite the UV texture
  const baseUrl = template?.uvMapUrl ?? uvMap?.imageUrl ?? null;
  const { canvas, version, ready } = useUvCompositor({
    baseUrl,
    zones,
    layers,
    uvWidth: uvMap?.uvWidth,
    uvHeight: uvMap?.uvHeight,
  });

  // ---- Nome / Número state ----
  const [nameText, setNameText] = useState('');
  const [nameZone, setNameZone] = useState<string>('');
  const [nameColor, setNameColor] = useState('#ffffff');
  const [nameStroke, setNameStroke] = useState('#000000');
  const [nameStrokeW, setNameStrokeW] = useState(0);
  const [nameSize, setNameSize] = useState(100);
  const [nameArc, setNameArc] = useState(0);
  const [nameFont, setNameFont] = useState('Arial');

  const [numberText, setNumberText] = useState('');
  const [numberZone, setNumberZone] = useState<string>('');
  const [numberColor, setNumberColor] = useState('#ffffff');
  const [numberStroke, setNumberStroke] = useState('#000000');
  const [numberStrokeW, setNumberStrokeW] = useState(0);

  useEffect(() => {
    if (!nameZone && zoneKeys.length) setNameZone(zoneKeys[0]);
    if (!numberZone && zoneKeys.length) setNumberZone(zoneKeys[Math.min(1, zoneKeys.length - 1)]);
  }, [zoneKeys.join('|')]);

  // Maintain a synthetic "name" + "number" layer reactive to inputs
  useEffect(() => {
    setLayers(prev => {
      const out = prev.filter(l => l.id !== '__name__' && l.id !== '__number__');
      if (nameText && nameZone) {
        out.push({
          id: '__name__', zoneKey: nameZone, type: 'text',
          content: nameText.toUpperCase(),
          fontFamily: nameFont, color: nameColor,
          strokeColor: nameStroke, strokeWidth: nameStrokeW,
          scale: nameSize / 100, arc: nameArc,
        });
      }
      if (numberText && numberZone) {
        out.push({
          id: '__number__', zoneKey: numberZone, type: 'text',
          content: numberText, fontFamily: nameFont,
          color: numberColor, strokeColor: numberStroke,
          strokeWidth: numberStrokeW, scale: 1.0,
        });
      }
      return out;
    });
  }, [nameText, nameZone, nameColor, nameStroke, nameStrokeW, nameSize, nameArc, nameFont,
      numberText, numberZone, numberColor, numberStroke, numberStrokeW]);

  // ---- Emblems ----
  const [emblems, setEmblems] = useState<Emblem[]>([]);
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('emblems' as any).select('id,name,image_url,category').eq('active', true).order('position', { ascending: true });
      setEmblems((data as any[]) ?? []);
    })();
  }, []);

  const addImageLayer = (url: string, zoneKey: string) => {
    const id = `img_${Date.now()}_${Math.random().toString(36).slice(2,7)}`;
    setLayers(p => [...p, { id, zoneKey, type: 'image', url, scale: 1 }]);
  };

  const removeLayer = (id: string) =>
    setLayers(p => p.filter(l => l.id !== id));

  // ---- Upload ----
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadZone, setUploadZone] = useState<string>('');
  useEffect(() => { if (!uploadZone && zoneKeys.length) setUploadZone(zoneKeys[0]); }, [zoneKeys.join('|')]);

  const handleUpload = async (file: File) => {
    const { data: sess } = await supabase.auth.getSession();
    const uid = sess.session?.user.id ?? 'anon';
    const path = `${uid}/uploads/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const { error } = await supabase.storage.from('shirt-designs').upload(path, file);
    if (error) { toast.error('Falha ao enviar imagem'); return; }
    const url = supabase.storage.from('shirt-designs').getPublicUrl(path).data.publicUrl;
    addImageLayer(url, uploadZone || zoneKeys[0] || 'frente');
    toast.success('Logo adicionada!');
  };

  // ---- Layers panel summary ----
  const userLayers = layers.filter(l => !l.id.startsWith('__'));

  if (loadingTpl) {
    return <div className="min-h-screen flex items-center justify-center bg-background"><p className="text-muted-foreground">Carregando editor…</p></div>;
  }
  if (!activeTemplates.length) {
    return <div className="min-h-screen flex items-center justify-center bg-background p-6 text-center">
      <div>
        <h2 className="text-xl font-bold mb-2">Nenhum modelo disponível</h2>
        <p className="text-muted-foreground">Peça ao administrador para cadastrar templates de camisa.</p>
      </div>
    </div>;
  }

  const ActiveIcon = TABS.find(t => t.id === activeTab)?.icon ?? Shirt;

  return (
    <div className="h-[100dvh] w-full flex bg-background overflow-hidden">
      {/* Sidebar de ícones */}
      <aside className="w-16 md:w-20 bg-sidebar border-r border-sidebar-border flex flex-col items-center py-4 gap-1 shrink-0">
        {TABS.map(t => {
          const Icon = t.icon;
          const active = activeTab === t.id && panelOpen;
          return (
            <button
              key={t.id}
              onClick={() => {
                if (activeTab === t.id) setPanelOpen(o => !o);
                else { setActiveTab(t.id); setPanelOpen(true); }
              }}
              className={`w-full flex flex-col items-center gap-1 py-3 text-[10px] font-semibold uppercase tracking-wide transition-all border-l-4 ${
                active
                  ? 'border-accent text-accent bg-sidebar-accent'
                  : 'border-transparent text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50'
              }`}
            >
              <Icon className="h-6 w-6" />
              <span>{t.label}</span>
            </button>
          );
        })}
      </aside>

      {/* Painel da aba */}
      {panelOpen && (
        <section className="w-72 md:w-80 bg-card border-r border-border flex flex-col shrink-0 shadow-lg">
          <header className="flex items-center justify-between p-4 border-b">
            <div className="flex items-center gap-2">
              <ActiveIcon className="h-5 w-5 text-accent" />
              <h2 className="text-base font-bold">{TABS.find(t => t.id === activeTab)?.label}</h2>
            </div>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setPanelOpen(false)}>
              <X className="h-4 w-4" />
            </Button>
          </header>

          <ScrollArea className="flex-1">
            <div className="p-4 space-y-5">
              {activeTab === 'modelo' && (
                <div className="grid grid-cols-2 gap-3">
                  {activeTemplates.map(t => (
                    <button
                      key={t.id}
                      onClick={() => setTemplateId(t.id)}
                      className={`group relative rounded-lg overflow-hidden border-2 transition-all ${templateId === t.id ? 'border-accent ring-2 ring-accent/40' : 'border-border hover:border-accent/60'}`}
                    >
                      <img src={t.frontImageUrl} alt={t.name} className="w-full aspect-square object-contain bg-muted" loading="lazy" />
                      <div className="absolute bottom-0 inset-x-0 bg-background/90 text-[10px] font-medium text-center py-1 truncate px-1">{t.name}</div>
                    </button>
                  ))}
                </div>
              )}

              {activeTab === 'cores' && (
                <div className="space-y-4">
                  <div>
                    <Label className="text-xs font-bold uppercase mb-2 block">Cor do tecido</Label>
                    <div className="grid grid-cols-6 gap-2">
                      {PRESET_COLORS.map(c => (
                        <button key={c} onClick={() => setFabricColor(c)}
                          className={`aspect-square rounded-md border-2 ${fabricColor === c ? 'border-accent ring-2 ring-accent/40' : 'border-border'}`}
                          style={{ backgroundColor: c }} />
                      ))}
                    </div>
                    <div className="mt-3">
                      <Input type="color" value={fabricColor} onChange={e => setFabricColor(e.target.value)} className="h-10 w-full p-1 cursor-pointer" />
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'nome' && (
                <div className="space-y-5">
                  {!zoneKeys.length && (
                    <p className="text-xs text-muted-foreground">Este template não tem zonas configuradas no UV. Peça ao admin.</p>
                  )}

                  <section className="space-y-3">
                    <h3 className="text-xs font-bold uppercase text-muted-foreground">Nome</h3>
                    <Input placeholder="Digite o nome" value={nameText} onChange={e => setNameText(e.target.value)} />
                    {zoneKeys.length > 0 && (
                      <Select value={nameZone} onValueChange={setNameZone}>
                        <SelectTrigger><SelectValue placeholder="Zona" /></SelectTrigger>
                        <SelectContent>
                          {zoneKeys.map(k => <SelectItem key={k} value={k}>{zones[k].label || k}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    )}
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-[10px] uppercase">Cor</Label>
                        <Input type="color" value={nameColor} onChange={e => setNameColor(e.target.value)} className="h-9 p-1" />
                      </div>
                      <div>
                        <Label className="text-[10px] uppercase">Contorno</Label>
                        <Input type="color" value={nameStroke} onChange={e => setNameStroke(e.target.value)} className="h-9 p-1" />
                      </div>
                    </div>
                    <div>
                      <Label className="text-[10px] uppercase mb-1 block">Espessura do contorno · {nameStrokeW}</Label>
                      <Slider value={[nameStrokeW]} max={20} step={1} onValueChange={([v]) => setNameStrokeW(v)} />
                    </div>
                    <div>
                      <Label className="text-[10px] uppercase mb-1 block">Tamanho · {nameSize}%</Label>
                      <Slider value={[nameSize]} min={40} max={150} step={5} onValueChange={([v]) => setNameSize(v)} />
                    </div>
                    <div>
                      <Label className="text-[10px] uppercase mb-1 block">Curvatura (arco) · {nameArc}</Label>
                      <Slider value={[nameArc]} min={-100} max={100} step={5} onValueChange={([v]) => setNameArc(v)} />
                    </div>
                    <div>
                      <Label className="text-[10px] uppercase mb-1 block">Fonte</Label>
                      <Select value={nameFont} onValueChange={setNameFont}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {['Arial','Impact','Georgia','Courier New','Verdana','Times New Roman'].map(f => (
                            <SelectItem key={f} value={f} style={{ fontFamily: f }}>{f}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </section>

                  <section className="space-y-3 pt-4 border-t">
                    <h3 className="text-xs font-bold uppercase text-muted-foreground">Número</h3>
                    <Input placeholder="Ex: 10" value={numberText} onChange={e => setNumberText(e.target.value.replace(/\D/g,'').slice(0,3))} />
                    {zoneKeys.length > 0 && (
                      <Select value={numberZone} onValueChange={setNumberZone}>
                        <SelectTrigger><SelectValue placeholder="Zona" /></SelectTrigger>
                        <SelectContent>
                          {zoneKeys.map(k => <SelectItem key={k} value={k}>{zones[k].label || k}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    )}
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-[10px] uppercase">Cor</Label>
                        <Input type="color" value={numberColor} onChange={e => setNumberColor(e.target.value)} className="h-9 p-1" />
                      </div>
                      <div>
                        <Label className="text-[10px] uppercase">Contorno</Label>
                        <Input type="color" value={numberStroke} onChange={e => setNumberStroke(e.target.value)} className="h-9 p-1" />
                      </div>
                    </div>
                    <div>
                      <Label className="text-[10px] uppercase mb-1 block">Espessura · {numberStrokeW}</Label>
                      <Slider value={[numberStrokeW]} max={20} step={1} onValueChange={([v]) => setNumberStrokeW(v)} />
                    </div>
                  </section>
                </div>
              )}

              {activeTab === 'emblemas' && (
                <div className="space-y-3">
                  {zoneKeys.length > 0 && (
                    <div>
                      <Label className="text-[10px] uppercase mb-1 block">Zona</Label>
                      <Select value={uploadZone} onValueChange={setUploadZone}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {zoneKeys.map(k => <SelectItem key={k} value={k}>{zones[k].label || k}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  {!emblems.length && (
                    <p className="text-xs text-muted-foreground">Nenhum emblema cadastrado. Peça ao admin.</p>
                  )}
                  <div className="grid grid-cols-3 gap-2">
                    {emblems.map(e => (
                      <button key={e.id}
                        onClick={() => addImageLayer(e.image_url, uploadZone || zoneKeys[0])}
                        className="aspect-square rounded-lg border-2 border-border hover:border-accent bg-muted p-2 transition-all">
                        <img src={e.image_url} alt={e.name} className="w-full h-full object-contain" loading="lazy" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === 'upload' && (
                <div className="space-y-3">
                  {zoneKeys.length > 0 && (
                    <div>
                      <Label className="text-[10px] uppercase mb-1 block">Zona de aplicação</Label>
                      <Select value={uploadZone} onValueChange={setUploadZone}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {zoneKeys.map(k => <SelectItem key={k} value={k}>{zones[k].label || k}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/svg+xml" hidden
                    onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f); e.target.value = ''; }} />
                  <Button variant="default" className="w-full" onClick={() => fileInputRef.current?.click()}>
                    <Upload className="h-4 w-4 mr-2" /> Enviar imagem / logo
                  </Button>
                  <p className="text-[11px] text-muted-foreground text-center">PNG, JPG ou SVG. Fundo transparente recomendado.</p>
                </div>
              )}

              {/* Layers list */}
              {userLayers.length > 0 && (
                <div className="pt-4 border-t">
                  <h3 className="text-xs font-bold uppercase text-muted-foreground mb-2">Camadas aplicadas</h3>
                  <div className="space-y-1">
                    {userLayers.map(l => (
                      <div key={l.id} className="flex items-center justify-between bg-muted/50 rounded px-2 py-1.5 text-xs">
                        <span className="truncate">{l.type === 'image' ? '🖼️ Imagem' : '🅰 Texto'} · {l.zoneKey}</span>
                        <button onClick={() => removeLayer(l.id)} className="text-destructive hover:bg-destructive/10 rounded p-1">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        </section>
      )}

      {/* Stage 3D */}
      <main className="flex-1 relative flex flex-col">
        <div className="flex items-center justify-end gap-2 p-3 border-b bg-card">
          <Button variant="outline" size="sm" onClick={() => toast.info('Em breve')}>
            <Save className="h-4 w-4 mr-2" /> Salvar
          </Button>
          <Button size="sm" onClick={() => toast.info('Em breve')}>
            <Send className="h-4 w-4 mr-2" /> Enviar Orçamento
          </Button>
        </div>
        <div className="flex-1 relative">
          {template && (
            <Shirt3DPreview
              frontImage={template.frontImageUrl}
              backImage={template.backImageUrl}
              uvMapUrl={baseUrl}
              uvCanvas={canvas}
              uvVersion={version}
              fabricColor={fabricColor}
              autoRotate={false}
            />
          )}
        </div>
      </main>
    </div>
  );
}
