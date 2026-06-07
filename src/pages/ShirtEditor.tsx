import { useState, useEffect, useRef, useCallback, Suspense, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { Canvas as FabricCanvas, FabricText, Textbox, FabricImage, Point, Polygon, FabricObject, Control, controlsUtils, Shadow } from 'fabric';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Type, Upload, Trash2, Download, Image as ImageIcon, ChevronLeft, Move, MapPin, ZoomIn, ZoomOut, RotateCcw, Shirt as ShirtIcon, Sparkles, X, Hand, Box, Palette, Scissors, Shield, PenTool, MousePointer2 } from 'lucide-react';
import EditorGuide, { type GuideStep } from '@/components/EditorGuide';
import { applyArcToText } from '@/lib/fabricArcText';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import logo from '@/assets/logo.png';
import { useTemplateZones, TemplateZone } from '@/hooks/useTemplateZones';
import { toProxyUrl } from '@/lib/imageProxy';
import { fetchAllStampColors, StampColor } from '@/hooks/useStampColors';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import Shirt3DPreview from '@/components/Shirt3DPreview';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { composeUvWithStamp, loadImage as loadUvImage } from '@/lib/composeMockup';
import { useUvCompositor } from '@/hooks/useUvCompositor';
import type { UvLayer } from '@/lib/uvCompositor';
import type { UvZone } from '@/hooks/useUvLibrary';

// Thumbnail component
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
  { label: 'Arial', value: 'Arial' },
  { label: 'Impact', value: 'Impact' },
  { label: 'Bebas Neue', value: 'Bebas Neue' },
  { label: 'Montserrat', value: 'Montserrat' },
];

type ToolbarTab = 'stamps' | 'text' | 'name' | 'emblems' | 'logo' | 'patches' | 'textStyles' | null;

const ShirtEditor = ({ useOwnAssets }: { useOwnAssets?: boolean }) => {
  const { id } = useParams();
  const [activeTab, setActiveTab] = useState<ToolbarTab>('stamps');
  const [stamps, setStamps] = useState<any[]>([]);
  const [appliedStamp, setAppliedStamp] = useState<any>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  const [show3D, setShow3D] = useState(false);
  
  // Fake data and simple stubs to restore basic functionality
  const addStamp = (stamp: any) => setAppliedStamp(stamp);
  const deleteSelected = () => {};

  return (
    <div className="h-[100dvh] bg-background flex flex-col overflow-hidden">
      <header className="bg-[#FF5C00] px-4 py-2 flex items-center justify-between shrink-0 shadow-md z-50 h-20 relative">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => {}} className="h-8 px-2 text-white hover:bg-white/10 hidden md:flex items-center">
            <ChevronLeft className="h-4 w-4" />
            <span className="ml-1 text-[10px] font-bold uppercase tracking-wider">Início</span>
          </Button>
          <img src="/public/uploads/colado-1780852849619.png" alt="Logo" className="h-14 w-auto brightness-0 invert" />
        </div>
        <div className="flex items-center gap-3">
          <Button className="bg-white text-[#FF5C00] hover:bg-white/90 rounded-full px-6 font-bold">Enviar Orçamento</Button>
          <Button className="bg-blue-600 text-white hover:bg-blue-700 rounded-full px-6 font-bold">Salvar Simulação</Button>
        </div>
      </header>

      <div className="hidden lg:flex flex-col shrink-0 bg-white border-b z-30">
        <div className="px-4 py-2 flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm font-medium">
            <ShirtIcon className="h-4 w-4" />
            Modelos / Estampas
          </div>
          <div className="flex gap-2">
            <button className="px-3 py-1 text-sm rounded-full bg-orange-100 text-orange-700">Camisa</button>
            <button className="px-3 py-1 text-sm rounded-full text-gray-500 hover:bg-gray-100">Calção</button>
            <button className="px-3 py-1 text-sm rounded-full text-gray-500 hover:bg-gray-100">Meião</button>
          </div>
          <div className="ml-auto flex items-center gap-2 text-xs">
            <span className="text-gray-500">Sincronizar Camisa e Calção</span>
            <Switch />
          </div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden relative bg-[#f5f5f5] z-10 h-[calc(100dvh-80px)]">
        <aside className="hidden lg:flex lg:flex-col lg:w-[80px] lg:bg-white lg:border-r border-slate-200 shadow-sm z-40 h-full">
          <TooltipProvider>
            <div className="flex flex-col py-2 gap-0">
              {[
                { id: 'stamps', label: 'Estilo', icon: ShirtIcon },
                { id: 'patches', label: 'Cores', icon: Palette },
                { id: 'textStyles', label: 'Acabamentos', icon: Scissors },
                { id: 'name', label: 'Nome/Número', icon: Type },
                { id: 'emblems', label: 'Escudo', icon: Shield },
                { id: 'logo', label: 'Upload', icon: Upload },
              ].map(({ id, label, icon: Icon }) => {
                const active = activeTab === id;
                return (
                  <Tooltip key={id}>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => setActiveTab(id as ToolbarTab)}
                        className={`flex flex-col items-center justify-center gap-1 group transition-all w-full py-4 relative border-r-4 ${active ? 'text-[#FF5C00] border-[#FF5C00] bg-orange-50/40' : 'text-slate-400 border-transparent hover:text-slate-600'}`}
                      >
                        <div className={`w-10 h-10 flex items-center justify-center rounded-lg transition-colors ${active ? 'bg-orange-100/50' : 'group-hover:bg-slate-50'}`}>
                          <Icon className={`h-6 w-6 ${active ? 'text-[#FF5C00]' : 'text-slate-400'}`} />
                        </div>
                        <span className={`text-[10px] font-bold uppercase tracking-tighter ${active ? 'text-[#FF5C00]' : 'text-slate-500'}`}>{label}</span>
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right">
                      <p>{label}</p>
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          </TooltipProvider>
        </aside>

        <aside className="hidden lg:flex lg:flex-col lg:w-[300px] lg:bg-white lg:border-r border-border z-30 h-full">
          <div className="flex-1 overflow-y-auto p-5 space-y-6">
            {!activeTab && (
              <div className="flex flex-col items-center justify-center h-full text-slate-400 space-y-2">
                <Box className="h-8 w-8 opacity-20" />
                <p className="text-xs font-medium">Selecione uma categoria para editar</p>
              </div>
            )}

              {/* 1. Personalização UV - Estilo */}
              {activeTab === 'stamps' && (
                <>
                  <div className="space-y-4">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700">Personalização UV</h3>
                    <div className="space-y-3">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold uppercase text-slate-500">Cor</label>
                        <div className="flex gap-2 flex-wrap">
                          {['#000000', '#FFFFFF', '#FF0000', '#0000FF', '#00FF00'].map(color => (
                            <button key={color} className="w-6 h-6 rounded-full border border-slate-200 shadow-sm" style={{ backgroundColor: color }} />
                          ))}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold uppercase text-slate-500">Contorno</label>
                          <Input className="h-8 text-xs" placeholder="0px" type="number" />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold uppercase text-slate-500">Espessura</label>
                          <Input className="h-8 text-xs" placeholder="1" type="number" />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold uppercase text-slate-500">Tamanho</label>
                        <Slider defaultValue={[50]} max={100} step={1} />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold uppercase text-slate-500">Fonte</label>
                        <Select defaultValue="Arial">
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue placeholder="Selecione a fonte" />
                          </SelectTrigger>
                          <SelectContent>
                            {FONT_OPTIONS.map(opt => (
                              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>

                  {/* 2. ESTAMPAS */}
                  <div className="space-y-4 pt-4 border-t">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700">Estampas</h3>
                    <div className="grid grid-cols-4 gap-2">
                      {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
                        <button key={i} className="aspect-square border rounded bg-slate-50 flex items-center justify-center hover:border-orange-500 transition-colors">
                          <ShirtIcon className="h-8 w-8 text-slate-300" />
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* 3. DIREITO & 4. NAME_BACK */}
              {activeTab === 'name' && (
                <div className="space-y-6">
                  {/* DIREITO */}
                  <div className="space-y-4">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700">Direito</h3>
                    <div className="space-y-3">
                      <Input className="h-9 text-xs" placeholder="Texto / nome / nº" />
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" className="flex-1 text-[10px] font-bold uppercase h-8">
                          <ImageIcon className="h-3 w-3 mr-1" /> Logo
                        </Button>
                        <Button variant="outline" size="sm" className="flex-1 text-[10px] font-bold uppercase h-8 text-destructive border-destructive/20 hover:bg-destructive/10">
                          <Trash2 className="h-3 w-3 mr-1" /> Limpar
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* NAME_BACK */}
                  <div className="space-y-4 pt-4 border-t">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700">Name_Back</h3>
                    <div className="space-y-3">
                      <Input className="h-9 text-xs" placeholder="Texto / nome / nº" />
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" className="flex-1 text-[10px] font-bold uppercase h-8">
                          <ImageIcon className="h-3 w-3 mr-1" /> Logo
                        </Button>
                        <Button variant="outline" size="sm" className="flex-1 text-[10px] font-bold uppercase h-8 text-destructive border-destructive/20 hover:bg-destructive/10">
                          <Trash2 className="h-3 w-3 mr-1" /> Limpar
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 5. Botões flutuantes de ferramentas no rodapé do painel */}
            <div className="p-4 border-t bg-slate-50 flex items-center justify-around">
              <button className="p-2 rounded-md hover:bg-white transition-colors text-slate-500" title="Texto">
                <Type className="h-5 w-5" />
              </button>
              <button className="p-2 rounded-md hover:bg-white transition-colors text-slate-500" title="Desenhar">
                <PenTool className="h-5 w-5" />
              </button>
              <button className="p-2 rounded-md hover:bg-white transition-colors text-slate-500" title="Mover">
                <MousePointer2 className="h-5 w-5" />
              </button>
              <button className="p-2 rounded-md hover:bg-white transition-colors text-destructive" title="Remover">
                <Trash2 className="h-5 w-5" />
              </button>
            </div>
          </aside>

        <main className="flex-1 relative bg-gradient-to-b from-sky-50 to-green-50 overflow-hidden">
          <div className="absolute inset-0 flex items-center justify-center p-8">
            <div className="w-full h-full max-h-[80vh] flex items-center justify-center relative">
               <Shirt3DPreview 
                 frontImage=""
                 backImage=""
               />
            </div>
          </div>
          
          <div className="absolute top-4 right-4 flex gap-2 z-20">
            <Button variant="secondary" className="bg-white hover:bg-slate-50 text-slate-700 px-6 py-2 rounded-full shadow-md border-0 font-bold text-xs uppercase tracking-wider">
              Girar
            </Button>
            <Button variant="secondary" onClick={() => setShow3D(false)} className="bg-white hover:bg-slate-50 text-slate-700 px-6 py-2 rounded-full shadow-md border-0 font-bold text-xs uppercase tracking-wider">
              Fechar
            </Button>
          </div>
        </main>
      </div>

      <footer className="hidden lg:flex bg-[#2D2D2D] text-white px-8 py-3 items-center justify-between z-50">
        <div className="text-[10px] font-medium text-slate-400">2025 Jumptec. Todos os direitos reservados.</div>
        <span className="text-xs font-black uppercase italic">Jumptec</span>
      </footer>
    </div>
  );
};

export default ShirtEditor;
