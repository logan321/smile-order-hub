import { useState, useEffect, useRef, useCallback } from 'react';
import { Canvas, FabricText, FabricImage } from 'fabric';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Type, Upload, Trash2, Download, Image as ImageIcon, ChevronLeft } from 'lucide-react';
import { toast } from 'sonner';
import logo from '@/assets/logo.png';

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

const CANVAS_WIDTH = 400;
const CANVAS_HEIGHT = 500;

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

  // Track current stamp per canvas for replacement
  const frontStampRef = useRef<FabricImage | null>(null);
  const backStampRef = useRef<FabricImage | null>(null);

  const getActiveCanvas = useCallback(() => {
    return activeView === 'front' ? frontFabricRef.current : backFabricRef.current;
  }, [activeView]);

  const getActiveStampRef = useCallback(() => {
    return activeView === 'front' ? frontStampRef : backStampRef;
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
  const loadBackground = useCallback(async (canvas: Canvas, imageUrl: string) => {
    try {
      const img = await FabricImage.fromURL(imageUrl, { crossOrigin: 'anonymous' });
      const scale = Math.min(CANVAS_WIDTH / img.width!, CANVAS_HEIGHT / img.height!);
      img.set({
        scaleX: scale,
        scaleY: scale,
        left: (CANVAS_WIDTH - img.width! * scale) / 2,
        top: (CANVAS_HEIGHT - img.height! * scale) / 2,
        selectable: false,
        evented: false,
      });
      (img as any)._isBackground = true;
      canvas.insertAt(0, img);
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

    loadBackground(frontCanvas, selectedTemplate.frontImageUrl);
    loadBackground(backCanvas, selectedTemplate.backImageUrl);

    return () => {
      frontCanvas.dispose();
      backCanvas.dispose();
      frontFabricRef.current = null;
      backFabricRef.current = null;
      frontStampRef.current = null;
      backStampRef.current = null;
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
    setActiveView('front');
    setSelectedTemplate(template);
  };

  // Add text with optional outline
  const addText = () => {
    const canvas = getActiveCanvas();
    if (!canvas || !textInput.trim()) return;

    const text = new FabricText(textInput, {
      left: CANVAS_WIDTH / 2 - 50,
      top: CANVAS_HEIGHT / 2,
      fontSize,
      fill: textColor,
      fontFamily: 'Arial',
      stroke: strokeWidth > 0 ? strokeColor : undefined,
      strokeWidth: strokeWidth > 0 ? strokeWidth : 0,
    });
    (text as any)._userElement = true;
    canvas.add(text);
    canvas.setActiveObject(text);
    canvas.renderAll();
    setTextInput('');
  };

  // Add/replace stamp — replaces existing stamp at same position/size
  const addStamp = async (stamp: Stamp) => {
    const canvas = getActiveCanvas();
    if (!canvas) return;

    const stampRef = getActiveStampRef();
    const oldStamp = stampRef.current;

    try {
      const img = await FabricImage.fromURL(stamp.imageUrl, { crossOrigin: 'anonymous' });

      if (oldStamp) {
        // Replace: use old stamp's position and scale
        const oldLeft = oldStamp.left!;
        const oldTop = oldStamp.top!;
        const oldScaleX = oldStamp.scaleX!;
        const oldScaleY = oldStamp.scaleY!;
        const oldAngle = oldStamp.angle || 0;

        // Calculate scale to fit into the same bounding box
        const oldBoundingWidth = oldStamp.width! * oldScaleX;
        const oldBoundingHeight = oldStamp.height! * oldScaleY;
        const newScaleX = oldBoundingWidth / img.width!;
        const newScaleY = oldBoundingHeight / img.height!;
        const uniformScale = Math.min(newScaleX, newScaleY);

        img.set({
          left: oldLeft,
          top: oldTop,
          scaleX: uniformScale,
          scaleY: uniformScale,
          angle: oldAngle,
        });

        canvas.remove(oldStamp);
      } else {
        // First stamp: fill the canvas area like the template
        const scale = Math.min(CANVAS_WIDTH / img.width!, CANVAS_HEIGHT / img.height!);
        img.set({
          left: (CANVAS_WIDTH - img.width! * scale) / 2,
          top: (CANVAS_HEIGHT - img.height! * scale) / 2,
          scaleX: scale,
          scaleY: scale,
        });
      }

      (img as any)._userElement = true;
      (img as any)._isStamp = true;
      canvas.add(img);
      canvas.setActiveObject(img);
      canvas.renderAll();
      stampRef.current = img;
    } catch {
      toast.error('Erro ao carregar estampa');
    }
  };

  // Upload custom logo
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const canvas = getActiveCanvas();
    if (!canvas) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const dataUrl = event.target!.result as string;
        const img = await FabricImage.fromURL(dataUrl);
        const maxSize = 150;
        const scale = Math.min(maxSize / img.width!, maxSize / img.height!);
        img.set({
          left: CANVAS_WIDTH / 2 - (img.width! * scale) / 2,
          top: CANVAS_HEIGHT / 3,
          scaleX: scale,
          scaleY: scale,
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
    e.target.value = '';
  };

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

  // Export canvas as PNG without background (transparent)
  const exportCanvasTransparent = (canvas: Canvas): string => {
    // Temporarily hide background image and set transparent bg
    const objects = canvas.getObjects();
    const bgObj = objects.find((o: any) => o._isBackground);
    const origBg = canvas.backgroundColor;

    if (bgObj) bgObj.set('visible', false);
    canvas.backgroundColor = 'transparent';
    canvas.discardActiveObject();
    canvas.renderAll();

    const dataUrl = canvas.toDataURL({ format: 'png', multiplier: 2 });

    // Restore
    if (bgObj) bgObj.set('visible', true);
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
      const frontDataUrl = exportCanvasTransparent(frontCanvas);
      const backDataUrl = exportCanvasTransparent(backCanvas);

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
      <header className="border-b border-border bg-card px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setSelectedTemplate(null)}>
            <ChevronLeft className="h-4 w-4 mr-1" /> Voltar
          </Button>
          <span className="text-sm font-medium">{selectedTemplate.name}</span>
        </div>
        <Button onClick={handleDownload} disabled={downloading} className="gap-2">
          <Download className="h-4 w-4" /> {downloading ? 'Baixando...' : 'Baixar Layout'}
        </Button>
      </header>

      <div className="flex-1 flex flex-col lg:flex-row">
        {/* Toolbar */}
        <aside className="lg:w-72 border-b lg:border-b-0 lg:border-r border-border bg-card p-4 space-y-4 overflow-y-auto">
          {/* Active view selector */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Editar lado</p>
            <div className="flex gap-2">
              <Button
                variant={activeView === 'front' ? 'default' : 'outline'}
                size="sm"
                className="flex-1"
                onClick={() => setActiveView('front')}
              >
                Frente
              </Button>
              <Button
                variant={activeView === 'back' ? 'default' : 'outline'}
                size="sm"
                className="flex-1"
                onClick={() => setActiveView('back')}
              >
                Costas
              </Button>
            </div>
          </div>

          {/* Add text with outline */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Adicionar Texto</p>
            <div className="space-y-2">
              <Input
                value={textInput}
                onChange={e => setTextInput(e.target.value)}
                placeholder="Digite o texto..."
                onKeyDown={e => e.key === 'Enter' && addText()}
              />
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <label className="text-xs text-muted-foreground">Cor</label>
                  <input
                    type="color"
                    value={textColor}
                    onChange={e => setTextColor(e.target.value)}
                    className="h-7 w-7 rounded border border-border cursor-pointer"
                  />
                </div>
                <div className="flex items-center gap-1.5">
                  <label className="text-xs text-muted-foreground">Tam</label>
                  <Input
                    type="number"
                    value={fontSize}
                    onChange={e => setFontSize(Number(e.target.value))}
                    className="h-7 w-16 text-xs"
                    min={10}
                    max={72}
                  />
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <label className="text-xs text-muted-foreground">Contorno</label>
                  <input
                    type="color"
                    value={strokeColor}
                    onChange={e => setStrokeColor(e.target.value)}
                    className="h-7 w-7 rounded border border-border cursor-pointer"
                  />
                </div>
                <div className="flex items-center gap-1.5">
                  <label className="text-xs text-muted-foreground">Espessura</label>
                  <Input
                    type="number"
                    value={strokeWidth}
                    onChange={e => setStrokeWidth(Number(e.target.value))}
                    className="h-7 w-16 text-xs"
                    min={0}
                    max={10}
                  />
                </div>
              </div>
              <Button size="sm" onClick={addText} disabled={!textInput.trim()} className="w-full gap-2 h-8">
                <Type className="h-3.5 w-3.5" /> Adicionar Texto
              </Button>
            </div>
          </div>

          {/* Upload logo */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Importar Logo / Imagem</p>
            <label className="flex items-center gap-2 px-3 py-2.5 border border-dashed border-border rounded-lg cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors">
              <Upload className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Clique para enviar imagem (PNG, JPG)</span>
              <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={handleLogoUpload} className="hidden" />
            </label>
          </div>

          {/* Stamps catalog */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Estampas</p>
            {stamps.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhuma estampa disponível</p>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {stamps.map(s => (
                  <button
                    key={s.id}
                    onClick={() => addStamp(s)}
                    className="rounded-lg border border-border/50 overflow-hidden hover:border-primary/50 transition-colors bg-background"
                    title={s.name}
                  >
                    <img src={s.imageUrl} alt={s.name} className="w-full aspect-square object-contain p-1" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Delete selected */}
          <Button variant="outline" size="sm" onClick={deleteSelected} className="w-full gap-2 text-destructive">
            <Trash2 className="h-3.5 w-3.5" /> Remover selecionado
          </Button>
        </aside>

        {/* Both canvases side by side */}
        <div className="flex-1 flex items-center justify-center gap-6 p-4 bg-muted/30 flex-wrap">
          <div
            className={`relative cursor-pointer transition-all ${activeView === 'front' ? 'ring-2 ring-primary ring-offset-2 rounded-xl' : 'opacity-60 hover:opacity-80'}`}
            onClick={() => setActiveView('front')}
          >
            <p className="text-center text-xs text-muted-foreground mb-2 font-medium uppercase tracking-wider">Frente</p>
            <div className="rounded-xl border border-border/50 shadow-lg overflow-hidden bg-background">
              <canvas ref={frontCanvasRef} />
            </div>
          </div>

          <div
            className={`relative cursor-pointer transition-all ${activeView === 'back' ? 'ring-2 ring-primary ring-offset-2 rounded-xl' : 'opacity-60 hover:opacity-80'}`}
            onClick={() => setActiveView('back')}
          >
            <p className="text-center text-xs text-muted-foreground mb-2 font-medium uppercase tracking-wider">Costas</p>
            <div className="rounded-xl border border-border/50 shadow-lg overflow-hidden bg-background">
              <canvas ref={backCanvasRef} />
            </div>
          </div>
        </div>
      </div>

    </div>
  );
};

export default ShirtEditor;
