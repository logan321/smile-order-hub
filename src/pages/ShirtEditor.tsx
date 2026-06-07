import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { Canvas, FabricText, Textbox, FabricImage, Point, Polygon, FabricObject, Control, controlsUtils } from 'fabric';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Type, Upload, Trash2, Download, Image as ImageIcon, ChevronLeft, Move, MapPin, ZoomIn, ZoomOut, RotateCcw, Shirt, Sparkles, X, Hand, Box, Settings } from 'lucide-react';
import EditorGuide, { type GuideStep } from '@/components/EditorGuide';
import { Shadow } from 'fabric';
import { applyArcToText } from '@/lib/fabricArcText';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { toast } from 'sonner';
import logo from '@/assets/logo.png';
import { useTemplateZones, TemplateZone } from '@/hooks/useTemplateZones';
import { toProxyUrl } from '@/lib/imageProxy';
import { fetchAllStampColors, StampColor } from '@/hooks/useStampColors';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import Shirt3DPreview from '@/components/Shirt3DPreview';
import { composeUvWithStamp, loadImage as loadUvImage } from '@/lib/composeMockup';
import { useUvCompositor } from '@/hooks/useUvCompositor';
import type { UvLayer } from '@/lib/uvCompositor';
import type { UvZone } from '@/hooks/useUvLibrary';

// Thumbnail: show only the 2D front image uploaded for the stamp.
function StampThumb({ stampUrl, name }: { stampUrl: string; name: string }) {
  const [error, setError] = useState(false);
  
  if (error || !stampUrl) {
    return (
      <div className="w-full aspect-square flex items-center justify-center bg-muted/20 rounded-lg">
        <ImageIcon className="h-8 w-8 text-muted-foreground" />
      </div>
    );
  }

  return (
    <img
      src={stampUrl}
      alt={name}
      loading="lazy"
      decoding="async"
      onError={() => setError(true)}
      className="w-full aspect-square object-contain p-1 protected-img bg-muted/10"
    />
  );
}

const isLikelyStampCode = (name: string) => /^[A-Za-z]{0,6}[-_.]?\d{1,6}[A-Za-z]{0,3}$/i.test(name.trim());

const isMisplacedStampTemplate = (template: Template) => {
  const front = template.frontImageUrl || '';
  const back = template.backImageUrl || '';
  const name = (template.name || '').trim();
  if (front && back && front === back) return true;
  if (/uv-library|uv-map/i.test(front) || /uv-library|uv-map/i.test(back)) return true;
  const nameLooksLikeCode = /^[A-Za-z]{0,6}[-_.]?\d{1,6}[A-Za-z]{0,3}$/i.test(name);
  return nameLooksLikeCode && (/colorway/i.test(front) || /colorway/i.test(back));
};

function Preview3DTabs({ front, back, uvMapUrl, cameraPosition, onCameraChange }: { front: string; back: string; uvMapUrl: string | null; cameraPosition: [number, number, number]; onCameraChange: (pos: [number, number, number]) => void }) {
  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div className="flex-1 min-h-0 relative">
        <Shirt3DPreview 
          frontImage={front} 
          backImage={back} 
          uvMapUrl={uvMapUrl} 
          cameraPosition={cameraPosition}
          autoRotate={false}
        />
      </div>
    </div>
  );
}

interface Niche { id: string; name: string; icon: string; patchLabel: string; coverImageUrl: string; backgroundImageUrl: string; }
interface Template { id: string; name: string; frontImageUrl: string; backImageUrl: string; uvMapUrl: string | null; uvMapId?: string | null; userId: string; nicheId: string | null; }
interface Stamp { id: string; name: string; category: string; imageUrl: string; backImageUrl: string | null; uvMapUrl?: string | null; uvMapId?: string | null; templateId?: string | null; nicheId?: string | null; }
type ToolbarTab = 'stamps' | 'text' | 'name' | 'emblems' | 'logo' | 'patches' | 'textStyles' | '3d' | null;
type PatchSideChoice = 'front' | 'back' | 'both' | null;

const CANVAS_WIDTH = 500;
const CANVAS_HEIGHT = 625;

const FONT_OPTIONS = [
  { label: 'Arial', value: 'Arial', google: false },
  { label: 'Impact', value: 'Impact', google: false },
  { label: 'Roboto', value: 'Roboto', google: true },
  { label: 'Montserrat', value: 'Montserrat', google: true },
  { label: 'Bebas Neue', value: 'Bebas Neue', google: true },
];

const ShirtEditor = ({ useOwnAssets }: { useOwnAssets?: boolean }) => {
  const { userId: urlUserId } = useParams<{ userId: string }>();
  const frontCanvasRef = useRef<HTMLCanvasElement>(null);
  const backCanvasRef = useRef<HTMLCanvasElement>(null);
  const frontFabricRef = useRef<Canvas | null>(null);
  const backFabricRef = useRef<Canvas | null>(null);
  const [activeView, setActiveView] = useState<'front' | 'back'>('front');
  const [activeTab, setActiveTab] = useState<ToolbarTab>('stamps');
  
  const [templates, setTemplates] = useState<Template[]>([]);
  const [stamps, setStamps] = useState<Stamp[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [loading, setLoading] = useState(true);
  const [cameraPosition, setCameraPosition] = useState<[number, number, number]>([0, 0.1, 5.2]);

  // UV personalization logic (Restored from stable version)
  const [uvMapZones, setUvMapZones] = useState<Record<string, UvZone>>({});
  const [uvMapDims, setUvMapDims] = useState<{ w: number | null; h: number | null }>({ w: null, h: null });
  const [uvLayers, setUvLayers] = useState<UvLayer[]>([]);
  const [appliedStamp, setAppliedStamp] = useState<Stamp | null>(null);
  const [appliedStampColors, setAppliedStampColors] = useState<StampColor[]>([]);
  const [activeStampColorId, setActiveStampColorId] = useState<string | null>(null);
  const [fabricColor, setFabricColor] = useState('#ffffff');
  const [textColor, setTextColor] = useState('#000000');
  const [strokeColor, setStrokeColor] = useState('#FFFFFF');
  const [strokeWidth, setStrokeWidth] = useState(0);
  const [fontSize, setFontSize] = useState(24);
  const [fontFamily, setFontFamily] = useState('Arial');
  const [textInput, setTextInput] = useState('');
  const [textCurvature, setTextCurvature] = useState(0);
  const [nameInput, setNameInput] = useState('');
  const [numberInput, setNumberInput] = useState('');
  const [patches, setPatches] = useState<any[]>([]);
  const [emblems, setEmblems] = useState<any[]>([]);
  const [currentPatchLabel, setCurrentPatchLabel] = useState('Peixes');

  // Recupera as zonas de UV do catálogo de moldes com base na estampa selecionada
  useEffect(() => {
    const fetchZones = async () => {
      const currentUvId = appliedStamp?.uvMapId || selectedTemplate?.uvMapId;
      if (!currentUvId) return;

      const { data } = await supabase
        .from('uv_maps' as any)
        .select('*')
        .eq('id', currentUvId)
        .single();
      
      if (data) {
        const u = data as any;
        setUvMapZones((u.uv_zones && typeof u.uv_zones === 'object') ? u.uv_zones as Record<string, UvZone> : {});
        setUvMapDims({ w: u.uv_width ?? null, h: u.uv_height ?? null });
      }
    };
    fetchZones();
  }, [appliedStamp, selectedTemplate]);

  // Sincroniza as camadas do UV (texto, nome, etc)
  const syncUvLayers = useCallback(() => {
    const layers: UvLayer[] = [];
    
    // Texto customizado - tentamos encontrar uma zona de texto ou usamos a primeira disponível
    const zoneKeys = Object.keys(uvMapZones);
    const textZone = zoneKeys.find(k => k.toLowerCase().includes('text')) || zoneKeys[0];

    if (textInput && textZone) {
      layers.push({
        id: 'custom-text',
        zoneKey: textZone,
        type: 'text',
        content: textInput,
        fontFamily,
        fontSize: fontSize * 2, // Escala para o molde UV
        color: textColor,
        strokeColor,
        strokeWidth,
        curvature: textCurvature,
      });
    }

    // Nome e Número - tentamos encontrar zonas específicas
    const nameZone = zoneKeys.find(k => k.toLowerCase().includes('name')) || zoneKeys[0];
    const numberZone = zoneKeys.find(k => k.toLowerCase().includes('number')) || zoneKeys[0];

    if (nameInput && nameZone) {
      layers.push({
        id: 'player-name',
        zoneKey: nameZone,
        type: 'text',
        content: nameInput,
        fontFamily,
        fontSize: fontSize * 3,
        color: textColor,
      });
    }

    if (numberInput && numberZone) {
      layers.push({
        id: 'player-number',
        zoneKey: numberZone,
        type: 'text',
        content: numberInput,
        fontFamily,
        fontSize: fontSize * 6,
        color: textColor,
      });
    }

    setUvLayers(layers);
  }, [textInput, nameInput, numberInput, fontFamily, fontSize, textColor, strokeColor, strokeWidth, textCurvature, uvMapZones]);

  useEffect(() => {
    syncUvLayers();
  }, [syncUvLayers]);

  useEffect(() => {
    syncUvLayers();
  }, [syncUvLayers]);

  // Load Data
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        let templatesQuery = supabase.from('shirt_templates').select('*');
        let stampsQuery = (supabase as any).from('stamp_catalog').select('*');
        let patchesQuery = (supabase as any).from('patch_catalog').select('*');
        let emblemsQuery = (supabase as any).from('emblems').select('*');

        // Determina qual ID de usuário usar para o filtro
        let filterUserId = urlUserId;
        
        if (useOwnAssets) {
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.user?.id) {
            filterUserId = session.user.id;
          }
        }

        console.log('Filtrando dados para o usuário:', filterUserId);

        // Se tivermos um ID para filtrar (seja da URL ou da sessão), aplicamos o filtro
        if (filterUserId) {
          templatesQuery = templatesQuery.eq('user_id', filterUserId);
          stampsQuery = stampsQuery.eq('user_id', filterUserId);
          patchesQuery = patchesQuery.eq('user_id', filterUserId);
          emblemsQuery = emblemsQuery.eq('user_id', filterUserId);
        }

        const [{ data: tData }, { data: sData }, { data: pData }, { data: eData }] = await Promise.all([
          templatesQuery,
          stampsQuery,
          patchesQuery,
          emblemsQuery
        ]);
        
        console.log('Templates data:', tData);
        console.log('Stamps data:', sData);
        
        const validTemplates = (tData as any[])?.filter(t => !isMisplacedStampTemplate(t)) || [];
        setTemplates(validTemplates);
        
        // Map stamps to ensure they have the required fields if missing
        const mappedStamps = (sData as any[])
          ?.filter(s => {
            // Regra estrita: apenas o que estiver explicitamente no catálogo de estampas
            // Filtramos qualquer coisa que contenha "uv" no nome ou na URL, ou que pareça ser um molde técnico
            const name = (s.name || '').toLowerCase();
            const url = (s.image_url || s.imageUrl || s.front_image_url || '').toLowerCase();
            if (name.includes('uv') || name.includes('map') || url.includes('uv-map') || url.includes('technical')) return false;
            
            // Garante que tenha uma imagem válida para exibir
            return !!url;
          })
          ?.map(s => ({
            ...s,
            imageUrl: s.image_url || s.front_image_url || s.imageUrl || '', 
            uvMapUrl: s.uv_map_url || s.uvMapUrl || null,
            backImageUrl: s.back_image_url || s.backImageUrl || null,
            category: s.category || 'Geral'
          })) || [];
        
        setStamps(mappedStamps);
        setPatches(pData || []);
        setEmblems(eData || []);
        
        // Auto-select first template if none selected
        if (validTemplates.length > 0 && !selectedTemplate) {
          setSelectedTemplate(validTemplates[0]);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const uvComposite = useUvCompositor({
    baseUrl: appliedStamp?.uvMapUrl ?? selectedTemplate?.uvMapUrl ?? null,
    zones: uvMapZones,
    layers: uvLayers,
    uvWidth: uvMapDims.w,
    uvHeight: uvMapDims.h,
  });

  const uvZonesActive = Object.keys(uvMapZones).length > 0;
  const effectiveUvUrl = appliedStamp?.uvMapUrl ?? selectedTemplate?.uvMapUrl ?? null;

  const addStamp = (s: Stamp) => {
    setAppliedStamp(s);
    toast.success(`Estampa ${s.name} selecionada`);
  };

  const handleWhatsAppQuote = () => toast.success("Orçamento enviado!");
  const handleDownload = () => toast.info("Baixando...");
  const handleOpen3D = () => setCameraPosition([0, 0.1, cameraPosition[2] === 5.2 ? -5.2 : 5.2]);
  const deleteSelected = () => toast.info("Removendo selecionado...");
  const handleAddTextClick = () => {
    if (!textInput) {
      toast.error("Digite um texto primeiro");
      return;
    }
    syncUvLayers();
    toast.success("Texto aplicado ao 3D!");
  };

  const addNamePreset = (type: string) => {
    syncUvLayers();
    toast.success(`Estilo ${type} aplicado!`);
  };

  const handlePatchClick = (p: any) => {
    const zoneKeys = Object.keys(uvMapZones);
    const patchZone = zoneKeys.find(k => k.toLowerCase().includes('patch') || k.toLowerCase().includes('logo')) || zoneKeys[0];
    
    if (!patchZone) {
      toast.error("Nenhuma zona de UV encontrada para este template");
      return;
    }

    const patchLayer: UvLayer = {
      id: `patch-${p.id}`,
      zoneKey: patchZone,
      type: 'image',
      url: p.imageUrl,
      scale: 0.8
    };
    setUvLayers(prev => [...prev, patchLayer]);
    toast.success(`${p.name} adicionado ao UV`);
  };

  const placeEmblemFromUrl = (url: string) => {
    const zoneKeys = Object.keys(uvMapZones);
    const emblemZone = zoneKeys.find(k => k.toLowerCase().includes('emblem') || k.toLowerCase().includes('escudo')) || zoneKeys[0];
    
    if (!emblemZone) {
      toast.error("Zona de UV para emblema não encontrada");
      return;
    }

    const emblemLayer: UvLayer = {
      id: `emblem-${Date.now()}`,
      zoneKey: emblemZone,
      type: 'image',
      url: url,
      scale: 0.6
    };
    setUvLayers(prev => [...prev, emblemLayer]);
    toast.success("Escudo adicionado");
  };
  const switchToOriginalStamp = () => setActiveStampColorId(null);
  const switchStampColor = (c: any) => setActiveStampColorId(c.id);
  const handleLogoUpload = () => toast.info("Enviando logo...");
  const handleEmblemUpload = () => toast.info("Enviando emblema...");

  if (loading) return <div className="h-screen flex items-center justify-center">Carregando...</div>;
  if (!selectedTemplate) return (
    <div className="p-8 grid grid-cols-2 md:grid-cols-4 gap-4">
      {templates.map(t => (
        <button key={t.id} onClick={() => setSelectedTemplate(t)} className="border p-4 rounded-xl hover:border-[#FF5A00]">
          <img src={t.frontImageUrl} className="w-full aspect-square object-contain" />
          <p className="mt-2 font-bold">{t.name}</p>
        </button>
      ))}
    </div>
  );

  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden">
      <header className="h-[60px] bg-white border-b border-gray-200 px-6 flex items-center justify-between shrink-0 z-50">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => setSelectedTemplate(null)}>
            <ChevronLeft className="h-4 w-4 mr-1" /> Voltar
          </Button>
          <span className="font-bold text-lg">{selectedTemplate.name}</span>
        </div>
      </header>

      <main className="flex flex-1 overflow-hidden" style={{ height: 'calc(100vh - 60px)' }}>
        {/* Coluna 1: Navegação */}
        <nav id="left-sidebar" className="w-20 bg-white shadow-lg border-r border-gray-200 flex-shrink-0 flex flex-col items-center py-6 space-y-8 z-40">
          {[
            { id: 'stamps', label: 'Estampa', icon: Shirt },
            { id: 'text', label: 'Texto', icon: Type },
            { id: 'name', label: 'Nome/Nº', icon: Shirt },
            { id: 'patches', label: 'Acab.', icon: Sparkles },
            { id: 'emblems', label: 'Escudo', icon: Box },
            { id: 'logo', label: 'Upload', icon: Upload },
            { id: '3d', label: 'Ajuste 3D', icon: Settings },
          ].map(({ id, label, icon: Icon }) => {
            const active = activeTab === id;
            return (
              <button key={id} onClick={() => setActiveTab(id as ToolbarTab)} className={`flex flex-col items-center gap-1.5 transition-colors ${active ? 'text-[#FF5A00]' : 'text-gray-400 hover:text-gray-600'}`}>
                <div className={`p-2 rounded-xl transition-all ${active ? 'bg-orange-50' : ''}`}><Icon className="h-6 w-6" /></div>
                <span className="text-[10px] font-bold uppercase">{label}</span>
              </button>
            );
          })}
        </nav>

        {/* Coluna 2: Painel Dinâmico */}
        <aside id="dynamicSidebar" className="w-80 bg-white shadow-lg border-r border-gray-200 flex-shrink-0 overflow-y-auto h-full z-30 p-6">
          <div className="space-y-6">
            {activeTab === 'stamps' && (
              <div className="animate-fade-in">
                <p className="text-xs font-bold text-muted-foreground uppercase mb-4 tracking-wider">Estampas</p>
                <div className="grid grid-cols-2 gap-3">
                  {stamps.length > 0 ? stamps.map(s => (
                    <button key={s.id} onClick={() => addStamp(s)} className={`group rounded-xl border-2 p-1.5 transition-all bg-card hover:shadow-md ${appliedStamp?.id === s.id ? 'border-[#FF5A00]' : 'border-border/50 hover:border-[#FF5A00]/50'}`}>
                      <StampThumb stampUrl={s.imageUrl} name={s.name} />
                      <p className="text-[10px] text-center mt-1.5 truncate font-bold">{s.name}</p>
                    </button>
                  )) : (
                    <div className="col-span-2 py-8 text-center text-muted-foreground text-xs italic">
                      Nenhuma estampa encontrada
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'text' && (
              <div className="space-y-5 animate-fade-in">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Textos</p>
                <Textarea value={textInput} onChange={e => setTextInput(e.target.value)} placeholder="Digite o texto..." className="min-h-[100px] focus:ring-[#FF5A00]" />
                <Select value={fontFamily} onValueChange={setFontFamily}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{FONT_OPTIONS.map(f => (<SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>))}</SelectContent></Select>
                <div className="grid grid-cols-2 gap-3">
                  <input type="color" value={textColor} onChange={e => setTextColor(e.target.value)} className="h-10 w-full rounded-lg cursor-pointer" />
                  <Input type="number" value={fontSize} onChange={e => setFontSize(Number(e.target.value))} />
                </div>
                <Button onClick={handleAddTextClick} className="w-full bg-[#FF5A00]">ADICIONAR AO 3D</Button>
                <Slider value={[textCurvature]} onValueChange={([v]) => setTextCurvature(v)} min={-100} max={100} />
              </div>
            )}

            {activeTab === 'name' && (
              <div className="space-y-5 animate-fade-in">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Identificação</p>
                <Input value={nameInput} onChange={e => setNameInput(e.target.value)} placeholder="NOME" className="h-11 uppercase font-black" />
                <Input value={numberInput} onChange={e => setNumberInput(e.target.value)} placeholder="10" className="h-11 text-xl font-black" />
                <div className="grid grid-cols-2 gap-3">
                  <Button variant="outline" onClick={() => addNamePreset('arc')}>ARCO</Button>
                  <Button variant="outline" onClick={() => addNamePreset('straight')}>RETO</Button>
                </div>
              </div>
            )}

            {activeTab === 'patches' && (
              <div className="animate-fade-in">
                <p className="text-xs font-bold text-muted-foreground uppercase mb-4 tracking-wider">{currentPatchLabel}</p>
                <div className="grid grid-cols-3 gap-2">
                  {patches.map(p => (
                    <button key={p.id} onClick={() => handlePatchClick(p)} className="rounded-xl border-2 border-border/50 p-1.5 bg-card hover:border-[#FF5A00]">
                      <div className="w-full aspect-square bg-center bg-contain bg-no-repeat" style={{ backgroundImage: `url(${p.imageUrl})` }} />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'emblems' && (
              <div className="space-y-5 animate-fade-in">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Escudos</p>
                <div className="grid grid-cols-3 gap-2">
                  {emblems.map(em => (
                    <button key={em.id} onClick={() => placeEmblemFromUrl(em.imageUrl)} className="rounded-xl border-2 border-border/50 p-1.5 bg-card hover:border-[#FF5A00]">
                      <img src={em.imageUrl} className="w-full aspect-square object-contain" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {activeTab === '3d' && (
              <div className="space-y-6 animate-fade-in">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Ajustes do Simulador</p>
                
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase text-muted-foreground">Cor do Tecido</label>
                    <div className="flex gap-2 flex-wrap">
                      {['#ffffff', '#000000', '#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff'].map(color => (
                        <button
                          key={color}
                          onClick={() => setFabricColor(color)}
                          className={`w-8 h-8 rounded-full border-2 ${fabricColor === color ? 'border-[#FF5A00]' : 'border-transparent'}`}
                          style={{ backgroundColor: color }}
                        />
                      ))}
                      <input 
                        type="color" 
                        value={fabricColor} 
                        onChange={(e) => setFabricColor(e.target.value)}
                        className="w-8 h-8 rounded-full cursor-pointer overflow-hidden border-none p-0"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase text-muted-foreground">Posição da Câmera</label>
                    <div className="grid grid-cols-2 gap-2">
                      <Button variant="outline" size="sm" onClick={() => setCameraPosition([0, 0.1, 5.2])}>Frente</Button>
                      <Button variant="outline" size="sm" onClick={() => setCameraPosition([0, 0.1, -5.2])}>Costas</Button>
                      <Button variant="outline" size="sm" onClick={() => setCameraPosition([5.2, 0.1, 0])}>Direita</Button>
                      <Button variant="outline" size="sm" onClick={() => setCameraPosition([-5.2, 0.1, 0])}>Esquerda</Button>
                    </div>
                  </div>

                  <div className="space-y-2 pt-2">
                    <label className="text-[10px] font-bold uppercase text-muted-foreground">Rotação Automática</label>
                    <Button 
                      variant="outline" 
                      className="w-full flex justify-between items-center"
                      onClick={() => handleOpen3D()}
                    >
                      Alternar Vista
                      <RotateCcw className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            )}


            <div className="mt-8 pt-4 border-t border-border/50">
              <Button variant="outline" onClick={() => {
                setUvLayers([]);
                setTextInput('');
                setNameInput('');
                setNumberInput('');
                toast.info("Personalizações removidas");
              }} className="w-full text-destructive hover:bg-destructive/10">REMOVER TUDO</Button>
            </div>
          </div>
        </aside>

        {/* Coluna 3: Simulador 3D */}
        <section className="flex-1 relative bg-[#F8F9FA] z-20">
          <div className="absolute top-6 left-6 z-50">
            <Button variant="outline" className="rounded-full shadow-lg bg-white border-none h-12 px-6 font-bold flex gap-2" onClick={handleOpen3D}>
              <RotateCcw className="h-5 w-5 text-[#FF5A00]" /> Girar Camisa
            </Button>
          </div>
          <div className="absolute top-6 right-6 z-50 flex gap-3">
            <Button variant="outline" className="rounded-full shadow-lg bg-white border-none h-12 px-6" onClick={handleDownload}>Salvar Simulação</Button>
            <Button className="rounded-full shadow-lg bg-[#FF5A00] hover:bg-[#e65100] h-12 px-8 font-black uppercase tracking-wider" onClick={handleWhatsAppQuote}>Enviar Orçamento</Button>
          </div>

          <div className="w-full h-full">
            <Shirt3DPreview 
              frontImage={selectedTemplate.frontImageUrl}
              backImage={selectedTemplate.backImageUrl}
              uvMapUrl={effectiveUvUrl}
              uvCanvas={uvZonesActive ? uvComposite.canvas : null}
              uvVersion={uvZonesActive ? uvComposite.version : 0}
              cameraPosition={cameraPosition}
              fabricColor={fabricColor}
              autoRotate={false}
            />
          </div>

          <div className="absolute right-6 top-1/2 -translate-y-1/2 flex flex-col gap-4 z-50">
            <button 
              className="w-12 h-12 bg-white rounded-full shadow-xl flex items-center justify-center hover:text-[#FF5A00]"
              onClick={() => setCameraPosition(prev => [prev[0], prev[1], Math.max(2, prev[2] - 1)])}
            >
              <ZoomIn className="h-6 w-6" />
            </button>
            <button 
              className="w-12 h-12 bg-white rounded-full shadow-xl flex items-center justify-center hover:text-[#FF5A00]"
              onClick={() => setCameraPosition(prev => [prev[0], prev[1], Math.min(10, prev[2] + 1)])}
            >
              <ZoomOut className="h-6 w-6" />
            </button>
            <div className="h-px bg-gray-200 w-8 mx-auto" />
            <button className="w-12 h-12 bg-white rounded-full shadow-xl flex items-center justify-center hover:text-[#FF5A00]" onClick={() => setCameraPosition([0, 0.1, 5.2])}><span className="text-[10px] font-black">FR</span></button>
            <button className="w-12 h-12 bg-white rounded-full shadow-xl flex items-center justify-center hover:text-[#FF5A00]" onClick={() => setCameraPosition([0, 0.1, -5.2])}><span className="text-[10px] font-black">CO</span></button>
          </div>
        </section>
      </main>
    </div>
  );
};

export default ShirtEditor;
