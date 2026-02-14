import { useState, useEffect, useRef, useCallback } from 'react';
import { Canvas, FabricText, FabricImage } from 'fabric';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Type, Upload, Trash2, Download, Image as ImageIcon, ChevronLeft, MapPin } from 'lucide-react';
import { toast } from 'sonner';
import logo from '@/assets/logo.png';
import { useTemplateZones, TemplateZone } from '@/hooks/useTemplateZones';

interface Template {
  id: string;
  name: string;
  frontImageUrl: string;
  backImageUrl: string;
  userId: string;
}

interface Stamp {
  id: string;
  name: string;
  category: string;
  imageUrl: string;
}

const CANVAS_WIDTH = 700;
const CANVAS_HEIGHT = 875;

const ShirtEditor = () => {
  const frontCanvasRef = useRef<HTMLCanvasElement>(null);
  const backCanvasRef = useRef<HTMLCanvasElement>(null);
  const frontFabricRef = useRef<Canvas | null>(null);
  const backFabricRef = useRef<Canvas | null>(null);
  const [activeView, setActiveView] = useState<'front' | 'back'>('front');

  const [templates, setTemplates] = useState<Template[]>([]);
  const [stamps, setStamps] = useState<Stamp[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [textInput, setTextInput] = useState('');
  const [textColor, setTextColor] = useState('#000000');
  const [strokeColor, setStrokeColor] = useState('#FFFFFF');
  const [strokeWidth, setStrokeWidth] = useState(0);
  const [fontSize, setFontSize] = useState(24);
  const [pendingLogoFile, setPendingLogoFile] = useState<File | null>(null);
  const [showZonePicker, setShowZonePicker] = useState<'text' | 'logo' | null>(null);

  // Fetch zones for selected template
  const { zones: templateZones } = useTemplateZones(selectedTemplate?.id);

  // Track current stamp per canvas for replacement
  const frontStampRef = useRef<FabricImage | null>(null);
  const backStampRef = useRef<FabricImage | null>(null);
  const frontClipRef = useRef<FabricImage | null>(null);
  const backClipRef = useRef<FabricImage | null>(null);

  const getActiveCanvas = useCallback(() => {
    return activeView === 'front' ? frontFabricRef.current : backFabricRef.current;
  }, [activeView]);

  const getActiveStampRef = useCallback(() => {
    return activeView === 'front' ? frontStampRef : backStampRef;
  }, [activeView]);

  const getActiveClipPath = useCallback(() => {
    return activeView === 'front' ? frontClipRef.current : backClipRef.current;
  }, [activeView]);

  // Fetch templates and stamps
  useEffect(() => {
    const fetchData = async () => {
      const [templatesRes, stampsRes] = await Promise.all([
        supabase.from('shirt_templates').select('*').eq('active', true),
        supabase.from('stamp_catalog').select('*').eq('active', true),
      ]);

      setTemplates((templatesRes.data as any[])?.map(t => ({
        id: t.id,
        name: t.name,
        frontImageUrl: t.front_image_url,
        backImageUrl: t.back_image_url,
        userId: t.user_id,
      })) ?? []);

      setStamps((stampsRes.data as any[])?.map(s => ({
        id: s.id,
        name: s.name,
        category: s.category,
        imageUrl: s.image_url,
      })) ?? []);

      setLoading(false);
    };
    fetchData();
  }, []);

  // Load background image onto a canvas
  const loadBackground = useCallback(async (canvas: Canvas, imageUrl: string, side: 'front' | 'back') => {
    try {
      const img = await FabricImage.fromURL(imageUrl, { crossOrigin: 'anonymous' });
      const scale = Math.min(CANVAS_WIDTH / img.width!, CANVAS_HEIGHT / img.height!);
      const left = (CANVAS_WIDTH - img.width! * scale) / 2;
      const top = (CANVAS_HEIGHT - img.height! * scale) / 2;
      img.set({
        scaleX: scale,
        scaleY: scale,
        left,
        top,
        selectable: false,
        evented: false,
      });
      (img as any)._isBackground = true;
      canvas.insertAt(0, img);

      // Create clip path from template silhouette (PowerClip effect)
      const clipImg = await FabricImage.fromURL(imageUrl, { crossOrigin: 'anonymous' });
      clipImg.set({
        scaleX: scale,
        scaleY: scale,
        left,
        top,
        absolutePositioned: true,
      });
      if (side === 'front') frontClipRef.current = clipImg;
      else backClipRef.current = clipImg;

      canvas.renderAll();
    } catch (e) {
      console.error('Failed to load background:', e);
    }
  }, []);

  // Initialize both canvases when template is selected
  useEffect(() => {
    if (!selectedTemplate) return;
    if (!frontCanvasRef.current || !backCanvasRef.current) return;
    if (frontFabricRef.current) return; // already initialized

    const frontCanvas = new Canvas(frontCanvasRef.current, {
      width: CANVAS_WIDTH,
      height: CANVAS_HEIGHT,
      backgroundColor: '#f5f5f5',
      selection: true,
    });
    frontFabricRef.current = frontCanvas;

    const backCanvas = new Canvas(backCanvasRef.current, {
      width: CANVAS_WIDTH,
      height: CANVAS_HEIGHT,
      backgroundColor: '#f5f5f5',
      selection: true,
    });
    backFabricRef.current = backCanvas;

    loadBackground(frontCanvas, selectedTemplate.frontImageUrl, 'front');
    loadBackground(backCanvas, selectedTemplate.backImageUrl, 'back');

    return () => {
      frontCanvas.dispose();
      backCanvas.dispose();
      frontFabricRef.current = null;
      backFabricRef.current = null;
      frontStampRef.current = null;
      backStampRef.current = null;
      frontClipRef.current = null;
      backClipRef.current = null;
    };
  }, [selectedTemplate, loadBackground]);

  // Select template
  const handleSelectTemplate = (template: Template) => {
    // Reset refs so canvases reinitialize
    if (frontFabricRef.current) {
      frontFabricRef.current.dispose();
      frontFabricRef.current = null;
    }
    if (backFabricRef.current) {
      backFabricRef.current.dispose();
      backFabricRef.current = null;
    }
    frontStampRef.current = null;
    backStampRef.current = null;
    frontClipRef.current = null;
    backClipRef.current = null;
    setActiveView('front');
    setSelectedTemplate(template);
  };

  // Add text - optionally at a zone position (centered in zone)
  const addTextAtZone = (zone?: TemplateZone) => {
    const canvas = getActiveCanvas();
    if (!canvas || !textInput.trim()) return;
    const clipPath = getActiveClipPath();

    const text = new FabricText(textInput, {
      fontSize,
      fill: textColor,
      fontFamily: 'Arial',
      stroke: strokeWidth > 0 ? strokeColor : undefined,
      strokeWidth: strokeWidth > 0 ? strokeWidth : 0,
      clipPath: clipPath || undefined,
    });

    if (zone) {
      // Scale text to fill zone proportionally
      const zoneX = (zone.xPercent / 100) * CANVAS_WIDTH;
      const zoneY = (zone.yPercent / 100) * CANVAS_HEIGHT;
      const zoneW = (zone.widthPercent / 100) * CANVAS_WIDTH;
      const zoneH = (zone.heightPercent / 100) * CANVAS_HEIGHT;
      const tw = text.width || 100;
      const th = text.height || fontSize;
      const fitScale = Math.min(zoneW / tw, zoneH / th);
      text.set({
        left: zoneX + (zoneW - tw * fitScale) / 2,
        top: zoneY + (zoneH - th * fitScale) / 2,
        scaleX: fitScale,
        scaleY: fitScale,
      });
    } else {
      text.set({
        left: CANVAS_WIDTH / 2 - (text.width || 100) / 2,
        top: CANVAS_HEIGHT / 2,
      });
    }

    (text as any)._userElement = true;
    canvas.add(text);
    canvas.setActiveObject(text);
    canvas.renderAll();
    setTextInput('');
    setShowZonePicker(null);
  };

  const handleAddTextClick = () => {
    if (!textInput.trim()) return;
    const zonesForSide = templateZones.filter(z => z.side === activeView);
    if (zonesForSide.length > 0) {
      setShowZonePicker('text');
    } else {
      addTextAtZone();
    }
  };

  // Add/replace stamp — REPLACES the background template image at index 0
  const addStamp = async (stamp: Stamp) => {
    const canvas = getActiveCanvas();
    if (!canvas) return;

    try {
      const img = await FabricImage.fromURL(stamp.imageUrl, { crossOrigin: 'anonymous' });

      // Find and remove the current background (index 0)
      const objects = canvas.getObjects();
      const bgObj = objects.find((o: any) => o._isBackground);
      if (bgObj) {
        canvas.remove(bgObj);
      }

      // Scale stamp to fill the canvas like the original template
      const scale = Math.min(CANVAS_WIDTH / img.width!, CANVAS_HEIGHT / img.height!);
      const left = (CANVAS_WIDTH - img.width! * scale) / 2;
      const top = (CANVAS_HEIGHT - img.height! * scale) / 2;
      img.set({
        scaleX: scale,
        scaleY: scale,
        left,
        top,
        selectable: false,
        evented: false,
      });
      (img as any)._isBackground = true;

      // Insert as the new background at index 0
      canvas.insertAt(0, img);

      // Update clip path to match the new background shape
      const clipImg = await FabricImage.fromURL(stamp.imageUrl, { crossOrigin: 'anonymous' });
      clipImg.set({
        scaleX: scale,
        scaleY: scale,
        left,
        top,
        absolutePositioned: true,
      });
      if (activeView === 'front') frontClipRef.current = clipImg;
      else backClipRef.current = clipImg;

      // Re-apply new clipPath to all existing user elements
      const newClip = activeView === 'front' ? frontClipRef.current : backClipRef.current;
      canvas.getObjects().forEach((obj: any) => {
        if (obj._userElement && !obj._isBackground) {
          obj.set({ clipPath: newClip || undefined });
        }
      });

      canvas.renderAll();
    } catch {
      toast.error('Erro ao carregar estampa');
    }
  };

  // Upload custom logo - store file, then show zone picker or place directly
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    const zonesForSide = templateZones.filter(z => z.side === activeView);
    if (zonesForSide.length > 0) {
      setPendingLogoFile(file);
      setShowZonePicker('logo');
    } else {
      placeLogoFile(file);
    }
  };

  const placeLogoFile = (file: File, zone?: TemplateZone) => {
    const canvas = getActiveCanvas();
    if (!canvas) return;
    const clipPath = getActiveClipPath();

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const dataUrl = event.target!.result as string;
        const img = await FabricImage.fromURL(dataUrl);

        let left: number, top: number, scale: number;

        if (zone) {
          // Fit logo inside the zone area
          const zoneX = (zone.xPercent / 100) * CANVAS_WIDTH;
          const zoneY = (zone.yPercent / 100) * CANVAS_HEIGHT;
          const zoneW = (zone.widthPercent / 100) * CANVAS_WIDTH;
          const zoneH = (zone.heightPercent / 100) * CANVAS_HEIGHT;
          scale = Math.min(zoneW / img.width!, zoneH / img.height!);
          left = zoneX + (zoneW - img.width! * scale) / 2;
          top = zoneY + (zoneH - img.height! * scale) / 2;
        } else {
          const maxSize = 150;
          scale = Math.min(maxSize / img.width!, maxSize / img.height!);
          left = CANVAS_WIDTH / 2 - (img.width! * scale) / 2;
          top = CANVAS_HEIGHT / 3;
        }

        img.set({
          left,
          top,
          scaleX: scale,
          scaleY: scale,
          clipPath: clipPath || undefined,
        });
        (img as any)._userElement = true;
        canvas.add(img);
        canvas.setActiveObject(img);
        canvas.renderAll();
      } catch {
        toast.error('Erro ao carregar imagem');
      }
    };
    reader.readAsDataURL(file);
    setShowZonePicker(null);
    setPendingLogoFile(null);
  };

  // Live-update selected text object when style controls change
  useEffect(() => {
    const canvas = getActiveCanvas();
    if (!canvas) return;
    const active = canvas.getActiveObject();
    if (active && active instanceof FabricText && (active as any)._userElement) {
      active.set({
        fill: textColor,
        stroke: strokeWidth > 0 ? strokeColor : undefined,
        strokeWidth: strokeWidth > 0 ? strokeWidth : 0,
        fontSize,
      });
      canvas.renderAll();
    }
  }, [textColor, strokeColor, strokeWidth, fontSize, activeView]);

  // Delete selected object
  const deleteSelected = () => {
    const canvas = getActiveCanvas();
    if (!canvas) return;
    const active = canvas.getActiveObject();
    if (active && (active as any)._userElement) {
      // If it's the stamp, clear ref
      if ((active as any)._isStamp) {
        getActiveStampRef().current = null;
      }
      canvas.remove(active);
      canvas.discardActiveObject();
      canvas.renderAll();
    }
  };

  // Export full canvas composition as transparent PNG
  const exportCanvas = (canvas: Canvas): string => {
    const origBg = canvas.backgroundColor;
    canvas.backgroundColor = 'transparent';
    canvas.discardActiveObject();
    canvas.renderAll();

    const dataUrl = canvas.toDataURL({ format: 'png', multiplier: 2 });

    canvas.backgroundColor = origBg as string;
    canvas.renderAll();

    return dataUrl;
  };

  // Download both canvases as separate PNGs
  const handleDownload = async () => {
    const frontCanvas = frontFabricRef.current;
    const backCanvas = backFabricRef.current;
    if (!frontCanvas || !backCanvas) return;

    setDownloading(true);
    try {
      const frontDataUrl = exportCanvas(frontCanvas);
      const backDataUrl = exportCanvas(backCanvas);

      // Download front
      const linkFront = document.createElement('a');
      linkFront.download = `${selectedTemplate?.name || 'camisa'}_frente.png`;
      linkFront.href = frontDataUrl;
      linkFront.click();

      // Small delay then download back
      await new Promise(r => setTimeout(r, 500));
      const linkBack = document.createElement('a');
      linkBack.download = `${selectedTemplate?.name || 'camisa'}_costas.png`;
      linkBack.href = backDataUrl;
      linkBack.click();

      toast.success('Downloads iniciados!');
    } catch (err) {
      console.error(err);
      toast.error('Erro ao gerar download');
    }
    setDownloading(false);
  };

  // Template selection screen
  if (!selectedTemplate) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="text-center mb-8">
            <img src={logo} alt="Logo" className="h-10 w-auto mx-auto mb-3" />
            <h1 className="text-2xl font-bold font-display">Editor de Camisas</h1>
            <p className="text-muted-foreground mt-1">Escolha um modelo para personalizar</p>
          </div>

          {loading ? (
            <p className="text-center text-muted-foreground">Carregando templates...</p>
          ) : templates.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <ImageIcon className="h-12 w-12 mx-auto mb-4 opacity-30" />
              <p className="text-lg font-medium">Nenhum template disponível</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {templates.map(t => (
                <button
                  key={t.id}
                  onClick={() => handleSelectTemplate(t)}
                  className="group rounded-xl border border-border/50 bg-card overflow-hidden hover:border-primary/50 hover:shadow-md transition-all"
                >
                  <div className="grid grid-cols-2 gap-1 p-2">
                    <img src={t.frontImageUrl} alt="Frente" className="w-full aspect-[3/4] object-contain rounded bg-muted/30" />
                    <img src={t.backImageUrl} alt="Costas" className="w-full aspect-[3/4] object-contain rounded bg-muted/30" />
                  </div>
                  <div className="px-3 py-2.5 border-t border-border/30">
                    <p className="text-sm font-semibold group-hover:text-primary transition-colors">{t.name}</p>
                    <p className="text-xs text-muted-foreground">Clique para personalizar</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Editor screen — both canvases side by side
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top bar */}
      <header className="border-b border-border bg-card px-3 py-2 sm:px-4 sm:py-3 flex items-center justify-between">
        <div className="flex items-center gap-2 sm:gap-3">
          <Button variant="ghost" size="sm" onClick={() => setSelectedTemplate(null)}>
            <ChevronLeft className="h-4 w-4 mr-1" /> Voltar
          </Button>
          <span className="text-sm font-medium truncate">{selectedTemplate.name}</span>
        </div>
        <Button onClick={handleDownload} disabled={downloading} size="sm" className="gap-2">
          <Download className="h-4 w-4" /> {downloading ? 'Baixando...' : 'Baixar'}
        </Button>
      </header>

      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Toolbar - compact */}
        <aside className="lg:w-60 border-b lg:border-b-0 lg:border-r border-border bg-card p-2.5 sm:p-3 space-y-2.5 overflow-y-auto max-h-[35vh] lg:max-h-none">
          {/* Active view selector */}
          <div className="flex gap-1.5">
            <Button
              variant={activeView === 'front' ? 'default' : 'outline'}
              size="sm"
              className="flex-1 h-7 text-xs"
              onClick={() => setActiveView('front')}
            >
              Frente
            </Button>
            <Button
              variant={activeView === 'back' ? 'default' : 'outline'}
              size="sm"
              className="flex-1 h-7 text-xs"
              onClick={() => setActiveView('back')}
            >
              Costas
            </Button>
          </div>

          {/* Add text with outline */}
          <div>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-1.5">Texto</p>
            <div className="space-y-1.5">
              <Input
                value={textInput}
                onChange={e => setTextInput(e.target.value)}
                placeholder="Digite o texto..."
                className="h-7 text-xs"
                onKeyDown={e => e.key === 'Enter' && handleAddTextClick()}
              />
              <div className="flex items-center gap-1.5 flex-wrap">
                <div className="flex items-center gap-1">
                  <label className="text-[10px] text-muted-foreground">Cor</label>
                  <input type="color" value={textColor} onChange={e => setTextColor(e.target.value)} className="h-6 w-6 rounded border border-border cursor-pointer" />
                </div>
                <div className="flex items-center gap-1">
                  <label className="text-[10px] text-muted-foreground">Tam</label>
                  <Input type="number" value={fontSize} onChange={e => setFontSize(Number(e.target.value))} className="h-6 w-14 text-[10px]" min={10} max={72} />
                </div>
                <div className="flex items-center gap-1">
                  <label className="text-[10px] text-muted-foreground">Cont</label>
                  <input type="color" value={strokeColor} onChange={e => setStrokeColor(e.target.value)} className="h-6 w-6 rounded border border-border cursor-pointer" />
                </div>
                <div className="flex items-center gap-1">
                  <label className="text-[10px] text-muted-foreground">Esp</label>
                  <Input type="number" value={strokeWidth} onChange={e => setStrokeWidth(Number(e.target.value))} className="h-6 w-14 text-[10px]" min={0} max={10} />
                </div>
              </div>
              <Button size="sm" onClick={handleAddTextClick} disabled={!textInput.trim()} className="w-full gap-1.5 h-7 text-xs">
                <Type className="h-3 w-3" /> Adicionar
              </Button>
            </div>
          </div>

          {/* Upload logo */}
          <div>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-1.5">Logo / Imagem</p>
            <label className="flex items-center gap-2 px-2.5 py-2 border border-dashed border-border rounded-lg cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors">
              <Upload className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Enviar imagem</span>
              <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={handleLogoUpload} className="hidden" />
            </label>
          </div>

          {/* Stamps catalog */}
          <div>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-1.5">Estampas</p>
            {stamps.length === 0 ? (
              <p className="text-[10px] text-muted-foreground">Nenhuma estampa</p>
            ) : (
              <div className="grid grid-cols-5 sm:grid-cols-4 lg:grid-cols-3 gap-1.5">
                {stamps.map(s => (
                  <button
                    key={s.id}
                    onClick={() => addStamp(s)}
                    className="rounded-md border border-border/50 overflow-hidden hover:border-primary/50 transition-colors bg-background"
                    title={s.name}
                  >
                    <img src={s.imageUrl} alt={s.name} className="w-full aspect-square object-contain p-0.5" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Delete selected */}
          <Button variant="outline" size="sm" onClick={deleteSelected} className="w-full gap-1.5 text-destructive h-7 text-xs">
            <Trash2 className="h-3 w-3" /> Remover selecionado
          </Button>
        </aside>

        {/* Both canvases - maximized */}
        <div className="flex-1 flex items-center justify-center p-2 sm:p-3 bg-muted/30 overflow-auto">
          <div className="flex flex-col md:flex-row gap-2 sm:gap-4 items-center canvas-area">
            <div
              className={`relative cursor-pointer transition-all flex-shrink-0 ${activeView === 'front' ? 'ring-2 ring-primary ring-offset-2 rounded-xl' : 'opacity-50 hover:opacity-75'}`}
              onClick={() => setActiveView('front')}
            >
              <p className="text-center text-[10px] text-muted-foreground mb-1 font-medium uppercase tracking-wider">Frente</p>
              <div className="rounded-xl border border-border/50 shadow-lg overflow-hidden bg-background">
                <canvas ref={frontCanvasRef} />
              </div>
            </div>

            <div
              className={`relative cursor-pointer transition-all flex-shrink-0 ${activeView === 'back' ? 'ring-2 ring-primary ring-offset-2 rounded-xl' : 'opacity-50 hover:opacity-75'}`}
              onClick={() => setActiveView('back')}
            >
              <p className="text-center text-[10px] text-muted-foreground mb-1 font-medium uppercase tracking-wider">Costas</p>
              <div className="rounded-xl border border-border/50 shadow-lg overflow-hidden bg-background">
                <canvas ref={backCanvasRef} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Zone picker modal */}
      {showZonePicker && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-xl shadow-xl max-w-sm w-full p-5">
            <div className="flex items-center gap-2 mb-4">
              <MapPin className="h-5 w-5 text-primary" />
              <h3 className="font-semibold">Onde posicionar?</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-3">
              Escolha a zona onde {showZonePicker === 'text' ? 'o texto' : 'a logo'} será posicionado(a):
            </p>
            <div className="space-y-2 mb-4">
              {templateZones
                .filter(z => z.side === activeView)
                .map(zone => (
                  <Button
                    key={zone.id}
                    variant="outline"
                    className="w-full justify-start gap-2"
                    onClick={() => {
                      if (showZonePicker === 'text') {
                        addTextAtZone(zone);
                      } else if (pendingLogoFile) {
                        placeLogoFile(pendingLogoFile, zone);
                      }
                    }}
                  >
                    <MapPin className="h-3.5 w-3.5" />
                    {zone.name}
                  </Button>
                ))}
            </div>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="flex-1"
                onClick={() => {
                  if (showZonePicker === 'text') {
                    addTextAtZone();
                  } else if (pendingLogoFile) {
                    placeLogoFile(pendingLogoFile);
                  }
                }}
              >
                Posição livre
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setShowZonePicker(null); setPendingLogoFile(null); }}
              >
                Cancelar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ShirtEditor;
