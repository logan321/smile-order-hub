import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { Canvas, FabricText, Textbox, FabricImage, Polygon, FabricObject, Control, controlsUtils, Shadow } from 'fabric';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Type, Upload, Trash2, Download, Image as ImageIcon, ChevronLeft, Move, MapPin, ZoomIn, ZoomOut, RotateCcw, Shirt, Sparkles, X, Hand, Box, Palette, Lock } from 'lucide-react';
import EditorGuide, { type GuideStep } from '@/components/EditorGuide';
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
import { SvgAnalyzer } from '@/lib/svgAnalyzer';
import { cmykToHex } from '@/lib/cmykEngine';

function StampThumb({ stampUrl, name }: { stampUrl: string; name: string }) {
  return (
    <img
      src={stampUrl}
      alt={name}
      loading="lazy"
      decoding="async"
      className="w-full aspect-square object-contain p-1 protected-img bg-muted/10"
    />
  );
}

const FONT_OPTIONS = [
  { label: 'Arial', value: 'Arial', google: false },
  { label: 'Impact', value: 'Impact', google: false },
  { label: 'Roboto', value: 'Roboto', google: true },
  { label: 'Montserrat', value: 'Montserrat', google: true },
  { label: 'Bebas Neue', value: 'Bebas Neue', google: true },
  { label: 'Pacifico', value: 'Pacifico', google: true },
];

const CANVAS_WIDTH = 500;
const CANVAS_HEIGHT = 625;

const renderRotateIcon = (ctx: CanvasRenderingContext2D, left: number, top: number, _styleOverride: any, fabricObject: any) => {
  const size = 28;
  ctx.save();
  ctx.translate(left, top);
  ctx.rotate((fabricObject.angle * Math.PI) / 180);
  ctx.beginPath(); ctx.arc(0, 0, size / 2, 0, Math.PI * 2);
  ctx.fillStyle = '#f59e0b'; ctx.fill();
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.stroke();
  ctx.restore();
};

const customMtrControl = new Control({
  x: 0, y: -0.5, offsetY: -40,
  actionHandler: controlsUtils.rotationWithSnapping,
  cursorStyleHandler: controlsUtils.rotationStyleHandler,
  withConnection: true, actionName: 'rotate', render: renderRotateIcon,
});

const ShirtEditor = () => {
  const { userId: urlUserId } = useParams<{ userId: string }>();
  const frontCanvasRef = useRef<HTMLCanvasElement>(null);
  const backCanvasRef = useRef<HTMLCanvasElement>(null);
  const frontFabricRef = useRef<Canvas | null>(null);
  const backFabricRef = useRef<Canvas | null>(null);
  const [activeView, setActiveView] = useState<'front' | 'back'>('front');
  const [activeTab, setActiveTab] = useState<'stamps' | 'text' | 'name' | 'emblems' | 'logo' | 'patches' | null>(null);
  const [showUvPanel, setShowUvPanel] = useState(false);

  const [fixedColors, setFixedColors] = useState({ cor1: '#FF0000', cor2: '#00FF00', cor3: '#0000FF', cor4: '#FFFFFF' });
  const [svgContent, setSvgContent] = useState<string | null>(null);
  const svgAnalyzer = useRef(new SvgAnalyzer());
  
  const [templates, setTemplates] = useState<any[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  const [stamps, setStamps] = useState<any[]>([]);
  const [appliedStamp, setAppliedStamp] = useState<any>(null);
  const [textInput, setTextInput] = useState('');
  const [textColor, setTextColor] = useState('#000000');
  const [fontFamily, setFontFamily] = useState('Arial');
  const [fontSize, setFontSize] = useState(24);
  const [strokeColor, setStrokeColor] = useState('#FFFFFF');
  const [strokeWidth, setStrokeWidth] = useState(0);
  const [shadowEnabled, setShadowEnabled] = useState(false);
  const [textCurvature, setTextCurvature] = useState(0);
  const [loading, setLoading] = useState(true);
  const [mobileScale, setMobileScale] = useState(1);
  const [cameraPosition, setCameraPosition] = useState<[number, number, number]>([0, 0.1, 5.2]);

  // Carregar dados iniciais
  useEffect(() => {
    const loadData = async () => {
      const { data: t } = await supabase.from('templates').select('*');
      const { data: s } = await supabase.from('stamps').select('*');
      if (t) { setTemplates(t as any[]); setSelectedTemplate(t[0]); }
      if (s) setStamps(s as any[]);
      setLoading(false);
    };
    loadData();
  }, []);

  const updateSvgColor = (layerIndex: number, newHex: string) => {
    if (!svgContent) {
        setFixedColors(prev => ({ ...prev, [`cor${layerIndex}`]: newHex }));
        return;
    }
    const parser = new DOMParser();
    const svgDoc = parser.parseFromString(svgContent, 'image/svg+xml');
    const className = `svg-camada-cor-${layerIndex}`;
    const elements = svgDoc.querySelectorAll(`.${className}, [class*="${className}"]`);
    elements.forEach(el => {
      if (el.hasAttribute('fill')) el.setAttribute('fill', newHex);
      if (el.hasAttribute('stroke')) el.setAttribute('stroke', newHex);
    });
    const serializer = new XMLSerializer();
    setSvgContent(serializer.serializeToString(svgDoc));
    setFixedColors(prev => ({ ...prev, [`cor${layerIndex}`]: newHex }));
  };

  const addStamp = async (stamp: any) => {
    setAppliedStamp(stamp);
    if (stamp.imageUrl.toLowerCase().endsWith('.svg')) {
      const response = await fetch(toProxyUrl(stamp.imageUrl));
      setSvgContent(await response.text());
    } else {
      setSvgContent(null);
    }
    setActiveTab('stamps');
  };

  if (loading || !selectedTemplate) return <div className="h-screen flex items-center justify-center">Carregando editor...</div>;

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden font-sans">
      <header className="h-14 lg:h-16 flex items-center justify-between px-4 border-b border-border/50 bg-card z-50">
        <div className="flex items-center gap-3">
          <img src={logo} alt="Logo" className="h-8 lg:h-10 w-auto" />
          <div className="h-8 w-px bg-border/50 mx-1 hidden lg:block" />
          <h1 className="text-sm lg:text-base font-bold text-foreground truncate max-w-[150px] lg:max-w-none">
            Editor de Camisas
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="hidden lg:flex gap-2"><Download className="h-4 w-4" /> Download</Button>
          <Button size="sm" className="bg-accent text-accent-foreground font-bold px-6">FINALIZAR</Button>
        </div>
      </header>

      <div className="shrink-0 bg-card/80 backdrop-blur border-b border-border/60 px-2 py-2 overflow-x-auto">
        <div className="flex items-center justify-start lg:justify-center gap-2 lg:gap-3 min-w-max mx-auto">
          {[
            { id: 'stamps', label: 'Estampas', icon: Shirt },
            { id: 'text', label: 'Texto', icon: Type },
            { id: 'logo', label: 'Logo', icon: Upload },
          ].map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setActiveTab(id as any)} className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-all ${activeTab === id ? 'text-accent' : 'text-muted-foreground'}`}>
              <span className={`h-12 w-12 rounded-2xl border-2 flex items-center justify-center ${activeTab === id ? 'bg-accent text-accent-foreground border-accent' : 'bg-background border-accent/60 text-accent'}`}>
                <Icon className="h-6 w-6" />
              </span>
              <span className="text-[10px] font-semibold">{label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
        {activeTab && (
          <aside className="hidden lg:block lg:w-80 lg:border-r border-border bg-card p-4 overflow-y-auto">
            {activeTab === 'stamps' && (
              <div className="space-y-6">
                <p className="text-xs font-bold uppercase text-muted-foreground">Escolha sua estampa</p>
                <div className="grid grid-cols-3 gap-2">
                  {stamps.map(s => (
                    <button key={s.id} onClick={() => addStamp(s)} className="rounded-lg border border-border overflow-hidden hover:border-primary transition-all">
                      <StampThumb stampUrl={s.imageUrl} name={s.name} />
                    </button>
                  ))}
                </div>

                <div className="pt-4 border-t border-border/50">
                  <p className="text-xs font-bold uppercase mb-4 flex items-center gap-2">
                    <Palette className="h-4 w-4 text-primary" /> Cores da Estampa
                  </p>
                  <div className="grid grid-cols-1 gap-3">
                    {[
                      { id: 1, label: 'Cor 1 (Principal)', key: 'cor1' },
                      { id: 2, label: 'Cor 2 (Secundária)', key: 'cor2' },
                      { id: 3, label: 'Cor 3 (Detalhes)', key: 'cor3' },
                      { id: 4, label: 'Cor 4 (Fundo)', key: 'cor4' },
                    ].map((color) => (
                      <div key={color.id} className="flex items-center justify-between p-3 rounded-xl bg-muted/30 border border-border/50">
                        <span className="text-[11px] font-bold">{color.label}</span>
                        <input 
                          type="color" 
                          value={(fixedColors as any)[color.key]} 
                          onChange={(e) => updateSvgColor(color.id, e.target.value)}
                          className="h-9 w-9 rounded-lg cursor-pointer"
                        />
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 p-3 rounded-lg bg-amber-50 border border-amber-100 flex gap-2">
                    <Lock className="h-4 w-4 text-amber-600 shrink-0" />
                    <p className="text-[10px] text-amber-700">Logomarcas e tigres são Imagens Fixas e não editáveis.</p>
                  </div>
                </div>
              </div>
            )}
            {activeTab === 'text' && (
              <div className="space-y-4">
                <Textarea placeholder="Seu texto aqui..." value={textInput} onChange={e => setTextInput(e.target.value)} />
                <Button className="w-full">Adicionar Texto</Button>
              </div>
            )}
          </aside>
        )}

        <main className="flex-1 bg-muted/20 relative flex items-center justify-center">
            <div className="w-full h-full max-w-4xl">
                <Shirt3DPreview
                    frontImage={selectedTemplate.frontImageUrl}
                    backImage={selectedTemplate.backImageUrl}
                    uvMapUrl={appliedStamp?.uvMapUrl || selectedTemplate.uvMapUrl}
                    cameraPosition={cameraPosition}
                    autoRotate={false}
                />
            </div>
            
            {/* Overlay Mobile */}
            {activeTab && (
              <div className="lg:hidden absolute inset-x-0 bottom-0 z-40 bg-card border-t-2 border-accent rounded-t-2xl p-4 max-h-[50vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-4">
                  <span className="font-bold uppercase text-xs">{activeTab}</span>
                  <button onClick={() => setActiveTab(null)}><X className="h-5 w-5" /></button>
                </div>
                {activeTab === 'stamps' && (
                    <div className="space-y-4">
                         <div className="grid grid-cols-4 gap-2">
                            {stamps.slice(0,8).map(s => (
                                <button key={s.id} onClick={() => addStamp(s)} className="rounded-lg border border-border overflow-hidden">
                                <StampThumb stampUrl={s.imageUrl} name={s.name} />
                                </button>
                            ))}
                        </div>
                        <div className="pt-4 border-t border-border/50">
                            <div className="grid grid-cols-2 gap-2">
                                {[1,2,3,4].map(i => (
                                    <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-muted/30 border border-border/50">
                                        <span className="text-[9px] font-bold">Cor {i}</span>
                                        <input type="color" value={(fixedColors as any)[`cor${i}`]} onChange={e => updateSvgColor(i, e.target.value)} className="h-7 w-7 rounded" />
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
              </div>
            )}
        </main>
      </div>
    </div>
  );
};

export default ShirtEditor;
