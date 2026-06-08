const USE_3D_SYSTEM = true;
import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { Canvas, FabricText, Textbox, FabricImage, Point, Polygon, FabricObject, Control, controlsUtils } from 'fabric';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Type, Upload, Trash2, Download, Image as ImageIcon, ChevronLeft, Move, MapPin, ZoomIn, ZoomOut, RotateCcw, Shirt, Sparkles, X, Hand, Box } from 'lucide-react';
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
import { cn } from '@/lib/utils';

interface Niche {
  id: string;
  name: string;
  icon: string;
  patchLabel: string;
  coverImageUrl: string;
  backgroundImageUrl: string;
}

interface Template {
  id: string;
  name: string;
  frontImageUrl: string;
  backImageUrl: string;
  uvMapUrl: string | null;
  uvMapId?: string | null;
  userId: string;
  nicheId: string | null;
}

interface Stamp {
  id: string;
  name: string;
  category: string;
  imageUrl: string;
  backImageUrl: string | null;
  uvMapUrl?: string | null;
  uvMapId?: string | null;
  templateId?: string | null;
  nicheId?: string | null;
}

type ToolbarTab = 'stamps' | 'text' | 'name' | 'emblems' | 'logo' | 'patches' | 'textStyles' | 'models' | null;

const CANVAS_WIDTH = 500;
const CANVAS_HEIGHT = 625;

const FONT_OPTIONS = [
  { label: 'Arial', value: 'Arial', google: false },
  { label: 'Impact', value: 'Impact', google: false },
  { label: 'Roboto', value: 'Roboto', google: true },
  { label: 'Montserrat', value: 'Montserrat', google: true },
  { label: 'Bebas Neue', value: 'Bebas Neue', google: true },
];

function StampThumb({ stampUrl, name }: { stampUrl: string; name: string }) {
  return (
    <img
      src={toProxyUrl(stampUrl)}
      alt={name}
      loading="lazy"
      decoding="async"
      className="w-full aspect-square object-contain p-1 bg-muted/10"
    />
  );
}

const ShirtEditor = ({ useOwnAssets }: { useOwnAssets?: boolean }) => {
  const { userId: urlUserId } = useParams<{ userId: string }>();
  const frontCanvasRef = useRef<HTMLCanvasElement>(null);
  const backCanvasRef = useRef<HTMLCanvasElement>(null);
  const frontFabricRef = useRef<Canvas | null>(null);
  const backFabricRef = useRef<Canvas | null>(null);
  const [activeView, setActiveView] = useState<'front' | 'back'>('front');
  const [activeTab, setActiveTab] = useState<ToolbarTab>('stamps');
  const [showUvPanel, setShowUvPanel] = useState(true);

  const [templates, setTemplates] = useState<Template[]>([]);
  const [allTemplates, setAllTemplates] = useState<Template[]>([]);
  const [stamps, setStamps] = useState<Stamp[]>([]);
  const [allStamps, setAllStamps] = useState<Stamp[]>([]);
  const [niches, setNiches] = useState<Niche[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [uv3DCanvas, setUv3DCanvas] = useState<HTMLCanvasElement | null>(null);
  const [uvTextureVersion, setUvTextureVersion] = useState(0);
  const [cameraPosition, setCameraPosition] = useState<[number, number, number]>([0, 0.1, 5.2]);
  const [appliedStamp, setAppliedStamp] = useState<Stamp | null>(null);
  const [fallbackUvUrl, setFallbackUvUrl] = useState<string | null>(null);
  const [ownerUserId, setOwnerUserId] = useState<string | null>(null);

  const [textColor, setTextColor] = useState('#000000');
  const [fontSize, setFontSize] = useState(24);
  const [fontFamily, setFontFamily] = useState('Arial');
  const [uvLayers, setUvLayers] = useState<UvLayer[]>([]);
  const [uvTextDrafts, setUvTextDrafts] = useState<Record<string, string>>({});
  const [uvMapZones, setUvMapZones] = useState<Record<string, UvZone>>({});
  const [uvMapDims, setUvMapDims] = useState<{ w: number | null; h: number | null }>({ w: null, h: null });
  const [globalTextInput, setGlobalTextInput] = useState('');
  const [selectedZone, setSelectedZone] = useState<string | null>(null);

  const uvTextCommitTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (urlUserId) {
      setOwnerUserId(urlUserId);
    } else {
      supabase.auth.getSession().then(({ data: { session } }) => {
        setOwnerUserId(session?.user?.id ?? null);
      });
    }
  }, [urlUserId]);

  useEffect(() => {
    if (!ownerUserId) return;
    const fetchData = async () => {
      const [templatesRes, stampsRes, nichesRes, uvMapsRes] = await Promise.all([
        supabase.from('shirt_templates').select('*').eq('active', true).eq('user_id', ownerUserId),
        supabase.from('stamp_catalog').select('*').eq('active', true).eq('user_id', ownerUserId),
        supabase.from('niches').select('*').eq('user_id', ownerUserId).order('position', { ascending: true }),
        supabase.from('uv_maps' as any).select('id, image_url, code, name').eq('user_id', ownerUserId),
      ]);

      const rawTemplates = (templatesRes.data as any[])?.map(t => ({
        id: t.id, name: t.name, frontImageUrl: t.front_image_url, backImageUrl: t.back_image_url,
        uvMapId: t.uv_map_id, uvMapUrl: t.uv_map_url,
        userId: t.user_id, nicheId: t.niche_id ?? null,
      })) ?? [];

      setAllTemplates(rawTemplates);
      setTemplates(rawTemplates);
      setStamps((stampsRes.data as any[])?.map(s => ({
        id: s.id, name: s.name, category: s.category, imageUrl: s.image_url, backImageUrl: s.back_image_url ?? null,
        uvMapUrl: s.uv_map_url,
      })) ?? []);
      setNiches((nichesRes.data as any[])?.map(n => ({
        id: n.id, name: n.name, icon: n.icon, patchLabel: n.patch_label, coverImageUrl: n.cover_image_url || '', backgroundImageUrl: n.background_image_url || '',
      })) ?? []);
      setLoading(false);
      if (rawTemplates.length > 0 && !selectedTemplate) {
        setSelectedTemplate(rawTemplates[0]);
      }
    };
    fetchData();
  }, [ownerUserId]);

  useEffect(() => {
    let cancelled = false;
    const uvMapId = selectedTemplate?.uvMapId;
    if (!uvMapId) { setUvMapZones({}); setUvMapDims({ w: null, h: null }); setUvLayers([]); return; }
    (async () => {
      const { data } = await supabase
        .from('uv_maps' as any)
        .select('uv_zones, uv_width, uv_height')
        .eq('id', uvMapId)
        .maybeSingle();
      if (cancelled || !data) return;
      const row = data as any;
      setUvMapZones((row.uv_zones && typeof row.uv_zones === 'object') ? row.uv_zones : {});
      setUvMapDims({ w: row.uv_width ?? null, h: row.uv_height ?? null });
      setUvLayers([]);
      setUvTextDrafts({});
    })();
    return () => { cancelled = true; };
  }, [selectedTemplate?.uvMapId]);

  const uvComposite = useUvCompositor({
    baseUrl: (appliedStamp?.uvMapUrl || selectedTemplate?.uvMapUrl || fallbackUvUrl) ? toProxyUrl(appliedStamp?.uvMapUrl || selectedTemplate?.uvMapUrl || fallbackUvUrl!) : null,
    zones: uvMapZones,
    layers: uvLayers,
    uvWidth: uvMapDims.w,
    uvHeight: uvMapDims.h,
  });

  useEffect(() => {
    if (uvComposite.ready) {
      setUv3DCanvas(uvComposite.canvas);
      setUvTextureVersion(uvComposite.version);
    }
  }, [uvComposite.version, uvComposite.ready, uvComposite.canvas]);

  const addStamp = (stamp: Stamp) => {
    setAppliedStamp(stamp);
    setUvTextureVersion(v => v + 1);
  };

  const setUvLayerText = (zoneKey: string, content: string) => {
    setUvTextDrafts(prev => ({ ...prev, [zoneKey]: content }));
    if (uvTextCommitTimerRef.current != null) window.clearTimeout(uvTextCommitTimerRef.current);
    uvTextCommitTimerRef.current = window.setTimeout(() => {
      uvTextCommitTimerRef.current = null;
      setUvLayers(prev => {
        const existing = prev.find(l => l.zoneKey === zoneKey && l.type === 'text');
        if (existing) {
          if (!content) return prev.filter(l => l !== existing);
          return prev.map(l => l === existing ? { ...l, content, color: textColor, fontFamily, fontSize, fontWeight: 900 } as UvLayer : l);
        }
        if (!content) return prev;
        return [...prev, { id: `${zoneKey}_${Date.now()}`, zoneKey, type: 'text', content, color: textColor, fontFamily, fontSize, fontWeight: 900 }];
      });
    }, 180);
  };

  const setUvLayerImage = (zoneKey: string, file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const url = typeof reader.result === 'string' ? reader.result : '';
      if (!url) return;
      setUvLayers(prev => [
        ...prev.filter(l => !(l.zoneKey === zoneKey && l.type === 'image')),
        { id: `${zoneKey}_image_${Date.now()}`, zoneKey, type: 'image', url, scale: 0.9, opacity: 1 } as UvLayer,
      ]);
    };
    reader.readAsDataURL(file);
  };

  const handleWhatsAppQuote = () => toast.info('Redirecionando para WhatsApp...');
  const handleDownload = () => toast.info('Gerando arquivos para download...');

  if (loading || !selectedTemplate) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-white">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-[#FF5A00] border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-black text-gray-400 uppercase tracking-widest">Carregando Simulador...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-white flex flex-col overflow-hidden">
      <header className="h-14 border-b border-gray-100 flex items-center justify-between px-6 bg-white shrink-0 z-50">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => setActiveTab('models')} className="text-gray-400 hover:text-gray-900"><Box className="w-5 h-5" /></Button>
          <img src={logo} alt="Jumptec" className="h-6 w-auto" />
          <div className="h-4 w-px bg-gray-200 mx-2" />
          <span className="font-bold text-gray-800 text-sm uppercase tracking-wide">{selectedTemplate.name}</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">Modo: 3D Simulator v2</span>
        </div>
      </header>

      <main className="flex flex-1 overflow-hidden h-[calc(100vh-3.5rem)]">
        {/* Coluna 1: Sidebar de Navegação */}
        <nav id="left-sidebar" className="w-14 lg:w-20 bg-white border-r border-gray-100 flex-shrink-0 flex flex-col items-center py-6 space-y-6 lg:space-y-8 z-30 shadow-[4px_0_10px_-5px_rgba(0,0,0,0.05)]">
          {[
            { id: 'models', label: 'Modelo', icon: Box },
            { id: 'stamps', label: 'Estampa', icon: Shirt },
            { id: 'text', label: 'Texto', icon: Type },
            { id: 'name', label: 'Nome/Nº', icon: Hand },
            { id: 'patches', label: 'Acabamento', icon: Sparkles },
            { id: 'emblems', label: 'Escudo', icon: ImageIcon },
            { id: 'logo', label: 'Upload', icon: Upload },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id as ToolbarTab)}
              className={`flex flex-col items-center gap-1 w-full py-2 transition-all relative ${activeTab === id ? 'text-[#FF5A00]' : 'text-gray-400 hover:text-gray-600'}`}
            >
              {activeTab === id && <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-[#FF5A00] rounded-l-full" />}
              <Icon className={cn("w-5 h-5 lg:w-6 lg:h-6", activeTab === id ? "animate-in zoom-in-50 duration-300" : "")} />
              <span className="text-[7px] lg:text-[9px] font-black uppercase tracking-tighter text-center px-1">{label}</span>
            </button>
          ))}
        </nav>

        {/* Coluna 2: Painel Dinâmico */}
        <div id="dynamicSidebar" className="w-48 md:w-64 lg:w-80 bg-white border-r border-gray-100 flex-shrink-0 overflow-y-auto z-20 shadow-[10px_0_30px_-5px_rgba(0,0,0,0.02)]">
          <div className="p-4 lg:p-6">
            <h2 className="text-[10px] lg:text-xs font-black text-gray-400 uppercase tracking-[0.2em] mb-4 lg:mb-6">
              Configurações de {activeTab === 'models' ? 'Modelo' : activeTab === 'stamps' ? 'Estampa' : activeTab === 'text' ? 'Texto' : activeTab === 'name' ? 'Nome/Número' : activeTab === 'patches' ? 'Acabamento' : activeTab === 'emblems' ? 'Escudo' : 'Upload'}
            </h2>
            
            <div className="space-y-4 lg:space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 lg:gap-3 p-1.5 bg-gray-50 rounded-2xl border border-gray-100">
                <div className="flex flex-col gap-1 p-2 bg-white rounded-xl border border-gray-100 shadow-sm">
                  <label className="text-[7px] lg:text-[8px] font-black text-gray-400 uppercase">Cor Principal</label>
                  <input type="color" value={textColor} onChange={e => setTextColor(e.target.value)} className="h-5 lg:h-6 w-full rounded cursor-pointer border-none" />
                </div>
                <div className="flex flex-col gap-1 p-2 bg-white rounded-xl border border-gray-100 shadow-sm">
                  <label className="text-[7px] lg:text-[8px] font-black text-gray-400 uppercase">Tamanho</label>
                  <Input type="number" value={fontSize} onChange={e => setFontSize(Number(e.target.value))} className="h-5 lg:h-6 border-none bg-transparent font-bold text-[10px] lg:text-xs p-0 focus-visible:ring-0" />
                </div>
              </div>

              {activeTab === 'models' && (
                <div className="grid grid-cols-2 gap-3">
                  {templates.map(t => (
                    <button
                      key={t.id}
                      onClick={() => setSelectedTemplate(t)}
                      className={`group rounded-xl lg:rounded-2xl border-2 overflow-hidden transition-all aspect-[3/4] relative ${selectedTemplate.id === t.id ? 'border-[#FF5A00] bg-[#FF5A00]/5' : 'border-gray-50 hover:border-gray-200'}`}
                    >
                      <div className="p-2">
                        <img src={toProxyUrl(t.frontImageUrl)} className="w-full h-full object-contain" />
                      </div>
                      <div className="absolute inset-x-0 bottom-0 bg-white/90 backdrop-blur-sm p-1 text-center">
                        <p className="text-[7px] lg:text-[8px] font-black uppercase text-gray-500 truncate px-1">{t.name}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {activeTab === 'stamps' && (
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 lg:gap-3">
                  {stamps.map(s => (
                    <button
                      key={s.id}
                      onClick={() => addStamp(s)}
                      className={`group rounded-xl lg:rounded-2xl border-2 overflow-hidden transition-all aspect-square relative ${appliedStamp?.id === s.id ? 'border-[#FF5A00] bg-[#FF5A00]/5' : 'border-gray-50 hover:border-gray-200'}`}
                    >
                      <StampThumb stampUrl={s.imageUrl} name={s.name} />
                      <div className="absolute inset-x-0 bottom-0 bg-white/90 backdrop-blur-sm p-1 text-center">
                        <p className="text-[7px] lg:text-[8px] font-black uppercase text-gray-500 truncate px-1">{s.name}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {(activeTab === 'text' || activeTab === 'name' || activeTab === 'logo') && (
                <div className="space-y-3 lg:space-y-4">
                  <Select value={fontFamily} onValueChange={setFontFamily}>
                    <SelectTrigger className="w-full h-10 lg:h-12 rounded-xl bg-gray-50 border-gray-100 shadow-sm font-bold text-[10px] lg:text-xs"><SelectValue placeholder="Fonte" /></SelectTrigger>
                    <SelectContent>{FONT_OPTIONS.map(f => (<SelectItem key={f.value} value={f.value} style={{ fontFamily: f.value }}>{f.label}</SelectItem>))}</SelectContent>
                  </Select>
                  
                  {Object.keys(uvMapZones).map((zoneKey) => (
                    <div key={zoneKey} className="p-3 lg:p-4 bg-white rounded-2xl border border-gray-100 shadow-sm space-y-2 lg:space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[8px] lg:text-[9px] font-black text-[#FF5A00] uppercase tracking-widest">{zoneKey}</span>
                        <div className="flex gap-1">
                           <button onClick={() => document.getElementById(`uv-file-${zoneKey}`)?.click()} className="p-1 hover:bg-gray-50 rounded-lg text-gray-400"><Upload className="w-3 lg:w-3.5 h-3 lg:h-3.5" /></button>
                           <button onClick={() => setUvLayerText(zoneKey, '')} className="p-1 hover:bg-gray-50 rounded-lg text-gray-400"><Trash2 className="w-3 lg:w-3.5 h-3 lg:h-3.5" /></button>
                        </div>
                      </div>
                      <Input
                        value={uvTextDrafts[zoneKey] ?? ''}
                        onChange={(e) => setUvLayerText(zoneKey, e.target.value)}
                        placeholder={`Digite aqui...`}
                        className="h-8 lg:h-10 bg-gray-50 border-none rounded-xl font-medium text-[10px] lg:text-xs focus-visible:ring-1 focus-visible:ring-[#FF5A00]/20"
                      />
                      <input id={`uv-file-${zoneKey}`} type="file" accept="image/*" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) setUvLayerImage(zoneKey, file); }} />
                    </div>
                  ))}
                </div>
              )}

              <div className="pt-4 lg:pt-6 border-t border-gray-50">
                <Button variant="ghost" size="sm" onClick={() => { setAppliedStamp(null); setUvLayers([]); setUvTextDrafts({}); setUvTextureVersion(v => v + 1); }} className="w-full text-[8px] lg:text-[9px] font-black text-gray-400 hover:text-red-500 uppercase tracking-widest">
                  <RotateCcw className="w-3 lg:w-3.5 h-3 lg:h-3.5 mr-2" /> Resetar Design
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Coluna 3: Canvas 3D */}
        <div className="flex-1 relative bg-[#F8F9FA] flex flex-col overflow-hidden">
          <div className="flex-1 relative">
            <Shirt3DPreview 
              frontImage={selectedTemplate?.frontImageUrl || ''} 
              backImage={selectedTemplate?.backImageUrl || ''} 
              uvCanvas={uv3DCanvas}
              uvVersion={uvTextureVersion}
              cameraPosition={cameraPosition}
              autoRotate={false}
            />
            
            {/* Overlay Actions */}
            <div className="absolute top-4 lg:top-6 right-4 lg:right-6 flex gap-2 lg:gap-3 z-30">
              <Button onClick={handleWhatsAppQuote} className="h-10 lg:h-12 px-4 lg:px-8 bg-[#FF5A00] hover:bg-[#FF5A00]/90 text-white font-black rounded-xl lg:rounded-2xl shadow-[0_10px_20px_-5px_rgba(255,90,0,0.3)] text-[10px] lg:text-xs uppercase tracking-widest gap-2 animate-in slide-in-from-top duration-500">
                 Orçamento <ChevronLeft className="w-3 h-3 lg:w-4 lg:h-4 rotate-180" />
              </Button>
              <Button onClick={handleDownload} variant="outline" className="h-10 lg:h-12 px-3 lg:px-6 bg-white border-none shadow-xl text-gray-700 font-bold rounded-xl lg:rounded-2xl hover:bg-gray-50 text-[10px] lg:text-xs uppercase tracking-wider">
                 <Download className="w-3.5 h-3.5 lg:w-4 lg:h-4" />
              </Button>
            </div>

            <button 
              className="absolute top-4 lg:top-6 left-4 lg:left-6 p-3 lg:p-4 bg-white hover:bg-gray-50 rounded-xl lg:rounded-2xl shadow-xl border border-gray-100 transition-all active:scale-95 group z-30" 
              onClick={() => setCameraPosition([0, 0.1, 5.2])}
            >
              <RotateCcw className="w-4 h-4 lg:w-5 lg:h-5 text-gray-400 group-hover:text-[#FF5A00] transition-colors" />
            </button>

            {/* Visual View Selectors */}
            <div className="absolute right-4 lg:right-6 top-1/2 -translate-y-1/2 flex flex-col gap-3 lg:gap-4 z-30">
               <button onClick={() => setCameraPosition([0, 0.1, 5.2])} className={cn("w-10 h-10 lg:w-14 lg:h-14 bg-white rounded-xl lg:rounded-2xl shadow-xl flex items-center justify-center hover:bg-gray-50 transition-all border-2", cameraPosition[2] > 0 ? "border-[#FF5A00]/50" : "border-gray-100")}><Shirt className={cn("w-5 h-5 lg:w-7 lg:h-7", cameraPosition[2] > 0 ? "text-[#FF5A00]" : "text-gray-300")} /></button>
               <button onClick={() => setCameraPosition([0, 0.1, -5.2])} className={cn("w-10 h-10 lg:w-14 lg:h-14 bg-white rounded-xl lg:rounded-2xl shadow-xl flex items-center justify-center hover:bg-gray-50 transition-all border-2", cameraPosition[2] < 0 ? "border-[#FF5A00]/50" : "border-gray-100")}><Shirt className={cn("w-5 h-5 lg:w-7 lg:h-7 rotate-180", cameraPosition[2] < 0 ? "text-[#FF5A00]" : "text-gray-300")} /></button>
            </div>
          </div>
          
          <div className="h-10 lg:h-12 bg-white/50 backdrop-blur-sm border-t border-gray-100 flex items-center justify-center gap-4 lg:gap-8 px-4 lg:px-6 shrink-0">
             <div className="flex items-center gap-1 lg:gap-2"><div className="w-1.5 lg:w-2 h-1.5 lg:h-2 rounded-full bg-green-500 animate-pulse" /><span className="text-[8px] lg:text-[10px] font-black text-gray-500 uppercase tracking-widest">3D Ativo</span></div>
             <div className="flex items-center gap-1 lg:gap-2"><div className="w-1.5 lg:w-2 h-1.5 lg:h-2 rounded-full bg-[#FF5A00]" /><span className="text-[8px] lg:text-[10px] font-black text-gray-500 uppercase tracking-widest">Sincronização Realtime</span></div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default ShirtEditor;
