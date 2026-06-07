import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { Canvas, FabricText, Textbox, FabricImage, Point, Polygon, FabricObject, Control, controlsUtils } from 'fabric';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Type, Upload, Trash2, Download, ChevronLeft, ZoomIn, ZoomOut, RotateCcw, Shirt, Sparkles, X, Hand, Box, ImageIcon, MapPin } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { toast } from 'sonner';
import { useTemplateZones, TemplateZone } from '@/hooks/useTemplateZones';
import { fetchAllStampColors, StampColor } from '@/hooks/useStampColors';
import Shirt3DPreview from '@/components/Shirt3DPreview';
import { useUvCompositor } from '@/hooks/useUvCompositor';
import type { UvLayer } from '@/lib/uvCompositor';
import type { UvZone } from '@/hooks/useUvLibrary';

// Thumbnail helper
function StampThumb({ stampUrl, name }: { stampUrl: string; name: string }) {
  return (
    <img
      src={stampUrl}
      alt={name}
      loading="lazy"
      className="w-full aspect-square object-contain p-1 bg-muted/10"
    />
  );
}

const CANVAS_WIDTH = 500;
const CANVAS_HEIGHT = 625;

const FONT_OPTIONS = [
  { label: 'Arial', value: 'Arial' },
  { label: 'Impact', value: 'Impact' },
  { label: 'Roboto', value: 'Roboto' },
  { label: 'Montserrat', value: 'Montserrat' },
  { label: 'Bebas Neue', value: 'Bebas Neue' },
];

interface Niche { id: string; name: string; icon: string; backgroundImageUrl: string; }
interface Template { id: string; name: string; frontImageUrl: string; backImageUrl: string; uvMapUrl: string | null; uvMapId?: string | null; }
interface Stamp { id: string; name: string; imageUrl: string; }
type ToolbarTab = 'stamps' | 'text' | 'name' | 'patches' | 'emblems' | 'logo' | null;

const ShirtEditor = ({ useOwnAssets }: { useOwnAssets?: boolean }) => {
  const { userId } = useParams();
  const [activeTab, setActiveTab] = useState<ToolbarTab>('stamps');
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [loading, setLoading] = useState(true);
  const [stamps, setStamps] = useState<Stamp[]>([]);
  const [activeView, setActiveView] = useState<'front' | 'back'>('front');
  const [cameraPosition, setCameraPosition] = useState<[number, number, number]>([0, 0.1, 5.2]);

  // States for text/design (placeholders for actual logic)
  const [textInput, setTextInput] = useState('');
  const [textColor, setTextColor] = useState('#000000');
  const [fontFamily, setFontFamily] = useState('Arial');
  const [fontSize, setFontSize] = useState(30);

  useEffect(() => {
    const loadData = async () => {
      // Mock fetch or actual supabase calls would go here
      // For now, setting loading false to show the layout
      setLoading(false);
    };
    loadData();
  }, []);

  const handleWhatsAppQuote = () => {
    toast.success("Orçamento enviado!");
  };

  const handleDownload = () => {
    toast.info("Iniciando download...");
  };

  if (loading) return <div className="h-screen flex items-center justify-center">Carregando...</div>;
  if (!selectedTemplate) {
    // Basic template picker if none selected (logic simplified for layout)
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-4">Escolha um Template</h1>
        <Button onClick={() => setSelectedTemplate({ id: '1', name: 'Camiseta Básica', frontImageUrl: '', backImageUrl: '', uvMapUrl: '' })}>
          Começar com Camiseta Básica
        </Button>
      </div>
    );
  }

  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden">
      {/* Header */}
      <header className="h-[60px] bg-white border-b border-gray-200 px-6 flex items-center justify-between shrink-0 z-50">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => setSelectedTemplate(null)}>
            <ChevronLeft className="h-4 w-4 mr-1" /> Voltar
          </Button>
          <span className="font-bold text-lg">{selectedTemplate.name}</span>
        </div>
        <div className="flex items-center gap-3">
          {/* Status indicators or other info */}
        </div>
      </header>

      <main className="flex flex-1 overflow-hidden" style={{ height: 'calc(100vh - 60px)' }}>
        {/* Coluna 1: Navegação Vertical */}
        <nav id="left-sidebar" className="w-20 bg-white shadow-lg border-r border-gray-200 flex-shrink-0 flex flex-col items-center py-6 space-y-8 z-40">
          {[
            { id: 'stamps', label: 'Estampa', icon: Shirt },
            { id: 'text', label: 'Texto', icon: Type },
            { id: 'name', label: 'Nome/Nº', icon: Shirt },
            { id: 'patches', label: 'Acab.', icon: Sparkles },
            { id: 'emblems', label: 'Escudo', icon: Box },
            { id: 'logo', label: 'Upload', icon: Upload },
          ].map(({ id, label, icon: Icon }) => {
            const active = activeTab === id;
            return (
              <button
                key={id}
                onClick={() => setActiveTab(id as ToolbarTab)}
                className={`flex flex-col items-center gap-1.5 transition-colors ${active ? 'text-[#FF5A00]' : 'text-gray-400 hover:text-gray-600'}`}
              >
                <div className={`p-2 rounded-xl transition-all ${active ? 'bg-orange-50' : ''}`}>
                  <Icon className="h-6 w-6" />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-tight">{label}</span>
              </button>
            );
          })}
        </nav>

        {/* Coluna 2: Painel Dinâmico de Configuração */}
        <aside id="dynamicSidebar" className="w-80 bg-white shadow-lg border-r border-gray-200 flex-shrink-0 overflow-y-auto h-full z-30">
          <div className="p-6">
            <header className="flex items-center justify-between mb-8">
              <h2 className="text-xl font-black uppercase tracking-tight flex items-center gap-2">
                {activeTab === 'stamps' && <><Shirt className="h-5 w-5 text-[#FF5A00]" /> Estampas</>}
                {activeTab === 'text' && <><Type className="h-5 w-5 text-[#FF5A00]" /> Textos</>}
                {activeTab === 'name' && <><Shirt className="h-5 w-5 text-[#FF5A00]" /> Nome e Número</>}
                {activeTab === 'patches' && <><Sparkles className="h-5 w-5 text-[#FF5A00]" /> Acabamentos</>}
                {activeTab === 'emblems' && <><Box className="h-5 w-5 text-[#FF5A00]" /> Escudos</>}
                {activeTab === 'logo' && <><Upload className="h-5 w-5 text-[#FF5A00]" /> Uploads</>}
              </h2>
            </header>

            <div className="space-y-6">
              {activeTab === 'stamps' && (
                <div className="grid grid-cols-2 gap-3">
                  {stamps.map(s => (
                    <button key={s.id} className="border border-gray-100 rounded-xl p-2 hover:border-[#FF5A00] transition-all bg-gray-50/50">
                      <img src={s.imageUrl} className="w-full aspect-square object-contain" />
                      <p className="text-[10px] font-bold mt-2 truncate">{s.name}</p>
                    </button>
                  ))}
                  {stamps.length === 0 && <p className="text-sm text-gray-400 col-span-2 text-center py-8">Nenhuma estampa encontrada</p>}
                </div>
              )}

              {activeTab === 'text' && (
                <div className="space-y-4">
                  <Textarea 
                    placeholder="Digite seu texto aqui..." 
                    className="min-h-[100px] border-gray-200 focus:ring-[#FF5A00]"
                  />
                  <div className="grid grid-cols-1 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-gray-400 uppercase">Fonte</label>
                      <Select value={fontFamily} onValueChange={setFontFamily}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {FONT_OPTIONS.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex gap-4">
                       <div className="flex-1 space-y-2">
                         <label className="text-xs font-bold text-gray-400 uppercase">Cor</label>
                         <div className="flex items-center gap-2">
                           <input type="color" value={textColor} onChange={e => setTextColor(e.target.value)} className="w-full h-10 rounded-lg cursor-pointer border-none" />
                         </div>
                       </div>
                       <div className="w-24 space-y-2">
                         <label className="text-xs font-bold text-gray-400 uppercase">Tamanho</label>
                         <Input type="number" value={fontSize} onChange={e => setFontSize(Number(e.target.value))} />
                       </div>
                    </div>
                  </div>
                  <Button className="w-full bg-[#FF5A00] hover:bg-[#e65100] h-12 font-bold uppercase tracking-wider">Adicionar Texto</Button>
                </div>
              )}

              {/* Other sections placeholders - keeping the logic structure for name, logo, etc. */}
              {activeTab === 'name' && (
                 <div className="space-y-4">
                    <Input placeholder="NOME DO JOGADOR" className="uppercase font-bold" />
                    <Input placeholder="00" className="text-center text-2xl font-black h-16" />
                    <Button className="w-full bg-[#FF5A00] hover:bg-[#e65100] h-12 font-bold uppercase tracking-wider">Aplicar ao Uniforme</Button>
                 </div>
              )}

              {activeTab === 'logo' && (
                <div className="space-y-4">
                  <div className="border-2 border-dashed border-gray-200 rounded-2xl p-8 flex flex-col items-center justify-center gap-3 bg-gray-50 hover:bg-white hover:border-[#FF5A00] transition-all cursor-pointer">
                    <Upload className="h-8 w-8 text-gray-400" />
                    <span className="text-xs font-bold text-gray-500 text-center">ARRASTE OU CLIQUE PARA ENVIAR LOGO (PNG/SVG)</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </aside>

        {/* Coluna 3: Simulador 3D */}
        <section className="flex-1 relative bg-[#F8F9FA] z-20">
          {/* Botões Superiores */}
          <div className="absolute top-6 left-6 z-50">
            <Button variant="outline" className="rounded-full shadow-lg bg-white border-none h-12 px-6 font-bold flex gap-2 hover:scale-105 transition-transform" onClick={() => setCameraPosition([0, 0.1, cameraPosition[2] === 5.2 ? -5.2 : 5.2])}>
              <RotateCcw className="h-5 w-5 text-[#FF5A00]" /> Girar Camisa
            </Button>
          </div>

          <div className="absolute top-6 right-6 z-50 flex gap-3">
            <Button variant="outline" className="rounded-full shadow-lg bg-white border-none h-12 px-6 font-bold hover:scale-105 transition-transform" onClick={handleDownload}>
              Salvar Simulação
            </Button>
            <Button className="rounded-full shadow-lg bg-[#FF5A00] hover:bg-[#e65100] border-none h-12 px-8 font-black uppercase tracking-wider hover:scale-105 transition-transform" onClick={handleWhatsAppQuote}>
              Enviar Orçamento
            </Button>
          </div>

          {/* Simulador 3D Real ocupar o centro */}
          <div className="w-full h-full flex items-center justify-center">
            <Shirt3DPreview 
              frontImage={selectedTemplate.frontImageUrl}
              backImage={selectedTemplate.backImageUrl}
              uvMapUrl={selectedTemplate.uvMapUrl}
              cameraPosition={cameraPosition}
              autoRotate={false}
            />
          </div>

          {/* Controles de Visualização à Direita */}
          <div className="absolute right-6 top-1/2 -translate-y-1/2 flex flex-col gap-4 z-50">
            <button className="w-12 h-12 bg-white rounded-full shadow-xl flex items-center justify-center hover:text-[#FF5A00] transition-colors" title="Zoom In">
              <ZoomIn className="h-6 w-6" />
            </button>
            <button className="w-12 h-12 bg-white rounded-full shadow-xl flex items-center justify-center hover:text-[#FF5A00] transition-colors" title="Zoom Out">
              <ZoomOut className="h-6 w-6" />
            </button>
            <div className="h-px bg-gray-200 w-8 mx-auto" />
            <button className="w-12 h-12 bg-white rounded-full shadow-xl flex items-center justify-center hover:text-[#FF5A00] transition-colors" onClick={() => setActiveView('front')}>
              <span className="text-[10px] font-black">FR</span>
            </button>
            <button className="w-12 h-12 bg-white rounded-full shadow-xl flex items-center justify-center hover:text-[#FF5A00] transition-colors" onClick={() => setActiveView('back')}>
              <span className="text-[10px] font-black">CO</span>
            </button>
          </div>
        </section>
      </main>
    </div>
  );
};

export default ShirtEditor;
