import { useState, useEffect, useRef, useCallback } from 'react';
import { Canvas, FabricText, FabricImage, Rect } from 'fabric';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Type, Upload, Trash2, Send, Image as ImageIcon, Palette, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
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
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricRef = useRef<Canvas | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [stamps, setStamps] = useState<Stamp[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [view, setView] = useState<'front' | 'back'>('front');
  const [loading, setLoading] = useState(true);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [textInput, setTextInput] = useState('');
  const [textColor, setTextColor] = useState('#000000');
  const [fontSize, setFontSize] = useState(24);
  const [showStamps, setShowStamps] = useState(false);

  // Store canvas state for front/back separately
  const frontStateRef = useRef<string | null>(null);
  const backStateRef = useRef<string | null>(null);

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

  // Initialize canvas
  useEffect(() => {
    if (!canvasRef.current || fabricRef.current) return;
    const canvas = new Canvas(canvasRef.current, {
      width: CANVAS_WIDTH,
      height: CANVAS_HEIGHT,
      backgroundColor: '#f5f5f5',
      selection: true,
    });
    fabricRef.current = canvas;

    return () => {
      canvas.dispose();
      fabricRef.current = null;
    };
  }, [selectedTemplate]);

  // Load template background image
  const loadBackground = useCallback(async (imageUrl: string) => {
    const canvas = fabricRef.current;
    if (!canvas) return;

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
        erasable: false,
      });

      // Remove old background (first object if it's the background)
      const objects = canvas.getObjects();
      if (objects.length > 0 && !(objects[0] as any)._userElement) {
        canvas.remove(objects[0]);
      }

      canvas.insertAt(0, img);
      canvas.renderAll();
    } catch (e) {
      console.error('Failed to load background:', e);
    }
  }, []);

  // Switch views (front/back)
  const switchView = useCallback(async (newView: 'front' | 'back') => {
    const canvas = fabricRef.current;
    if (!canvas || !selectedTemplate) return;

    // Save current view state (excluding background)
    const objects = canvas.getObjects().filter((o: any) => o._userElement);
    const currentState = JSON.stringify(objects.map(o => o.toJSON()));
    
    if (view === 'front') {
      frontStateRef.current = currentState;
    } else {
      backStateRef.current = currentState;
    }

    // Clear canvas
    canvas.clear();
    canvas.backgroundColor = '#f5f5f5';

    // Load new background
    const bgUrl = newView === 'front' ? selectedTemplate.frontImageUrl : selectedTemplate.backImageUrl;
    await loadBackground(bgUrl);

    // Restore saved state for new view
    const savedState = newView === 'front' ? frontStateRef.current : backStateRef.current;
    if (savedState) {
      try {
        const parsed = JSON.parse(savedState);
        for (const objData of parsed) {
          if (objData.type === 'FabricText' || objData.type === 'text') {
            const text = new FabricText(objData.text || '', {
              left: objData.left,
              top: objData.top,
              fontSize: objData.fontSize,
              fill: objData.fill,
              fontFamily: objData.fontFamily || 'Arial',
              scaleX: objData.scaleX,
              scaleY: objData.scaleY,
              angle: objData.angle,
            });
            (text as any)._userElement = true;
            canvas.add(text);
          }
        }
      } catch { /* ignore */ }
    }

    canvas.renderAll();
    setView(newView);
  }, [view, selectedTemplate, loadBackground]);

  // Select template
  const handleSelectTemplate = async (template: Template) => {
    setSelectedTemplate(template);
    frontStateRef.current = null;
    backStateRef.current = null;
    setView('front');

    // Wait for canvas to initialize
    setTimeout(async () => {
      if (fabricRef.current) {
        fabricRef.current.clear();
        fabricRef.current.backgroundColor = '#f5f5f5';
        await loadBackground(template.frontImageUrl);
      }
    }, 100);
  };

  // Add text to canvas
  const addText = () => {
    const canvas = fabricRef.current;
    if (!canvas || !textInput.trim()) return;

    const text = new FabricText(textInput, {
      left: CANVAS_WIDTH / 2 - 50,
      top: CANVAS_HEIGHT / 2,
      fontSize: fontSize,
      fill: textColor,
      fontFamily: 'Arial',
      editable: true,
    });
    (text as any)._userElement = true;
    canvas.add(text);
    canvas.setActiveObject(text);
    canvas.renderAll();
    setTextInput('');
  };

  // Add stamp to canvas
  const addStamp = async (stamp: Stamp) => {
    const canvas = fabricRef.current;
    if (!canvas) return;

    try {
      const img = await FabricImage.fromURL(stamp.imageUrl, { crossOrigin: 'anonymous' });
      const maxSize = 120;
      const scale = Math.min(maxSize / img.width!, maxSize / img.height!);
      img.set({
        left: CANVAS_WIDTH / 2 - (img.width! * scale) / 2,
        top: CANVAS_HEIGHT / 2 - (img.height! * scale) / 2,
        scaleX: scale,
        scaleY: scale,
      });
      (img as any)._userElement = true;
      canvas.add(img);
      canvas.setActiveObject(img);
      canvas.renderAll();
      setShowStamps(false);
    } catch {
      toast.error('Erro ao carregar estampa');
    }
  };

  // Upload custom logo
  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const canvas = fabricRef.current;
    if (!canvas) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const img = await FabricImage.fromURL(event.target!.result as string);
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
    const canvas = fabricRef.current;
    if (!canvas) return;
    const active = canvas.getActiveObject();
    if (active && (active as any)._userElement) {
      canvas.remove(active);
      canvas.discardActiveObject();
      canvas.renderAll();
    }
  };

  // Submit design
  const handleSubmit = async () => {
    if (!clientName.trim()) { toast.error('Informe seu nome'); return; }
    if (!selectedTemplate) return;
    const canvas = fabricRef.current;
    if (!canvas) return;

    setSubmitting(true);
    try {
      // Save current view state
      const currentObjects = canvas.getObjects().filter((o: any) => o._userElement);
      const currentState = JSON.stringify(currentObjects.map(o => o.toJSON()));
      if (view === 'front') frontStateRef.current = currentState;
      else backStateRef.current = currentState;

      // Export front preview
      // First ensure front is loaded
      canvas.clear();
      canvas.backgroundColor = '#f5f5f5';
      await loadBackground(selectedTemplate.frontImageUrl);
      if (frontStateRef.current) {
        try {
          const parsed = JSON.parse(frontStateRef.current);
          for (const objData of parsed) {
            if (objData.type === 'FabricText' || objData.type === 'text') {
              const t = new FabricText(objData.text || '', {
                left: objData.left, top: objData.top, fontSize: objData.fontSize,
                fill: objData.fill, fontFamily: objData.fontFamily || 'Arial',
                scaleX: objData.scaleX, scaleY: objData.scaleY, angle: objData.angle,
              });
              (t as any)._userElement = true;
              canvas.add(t);
            }
          }
        } catch { /* */ }
      }
      canvas.discardActiveObject();
      canvas.renderAll();
      const frontDataUrl = canvas.toDataURL({ format: 'png', multiplier: 2 });

      // Export back preview
      canvas.clear();
      canvas.backgroundColor = '#f5f5f5';
      await loadBackground(selectedTemplate.backImageUrl);
      if (backStateRef.current) {
        try {
          const parsed = JSON.parse(backStateRef.current);
          for (const objData of parsed) {
            if (objData.type === 'FabricText' || objData.type === 'text') {
              const t = new FabricText(objData.text || '', {
                left: objData.left, top: objData.top, fontSize: objData.fontSize,
                fill: objData.fill, fontFamily: objData.fontFamily || 'Arial',
                scaleX: objData.scaleX, scaleY: objData.scaleY, angle: objData.angle,
              });
              (t as any)._userElement = true;
              canvas.add(t);
            }
          }
        } catch { /* */ }
      }
      canvas.discardActiveObject();
      canvas.renderAll();
      const backDataUrl = canvas.toDataURL({ format: 'png', multiplier: 2 });

      // Upload previews to storage
      const ts = Date.now();
      const frontBlob = await (await fetch(frontDataUrl)).blob();
      const backBlob = await (await fetch(backDataUrl)).blob();

      const frontPath = `${selectedTemplate.userId}/${ts}_front.png`;
      const backPath = `${selectedTemplate.userId}/${ts}_back.png`;

      await supabase.storage.from('shirt-designs').upload(frontPath, frontBlob);
      await supabase.storage.from('shirt-designs').upload(backPath, backBlob);

      const { data: frontUrl } = supabase.storage.from('shirt-designs').getPublicUrl(frontPath);
      const { data: backUrl } = supabase.storage.from('shirt-designs').getPublicUrl(backPath);

      // Save design to database
      const { error } = await supabase.from('shirt_designs').insert({
        template_id: selectedTemplate.id,
        owner_user_id: selectedTemplate.userId,
        client_name: clientName.trim(),
        client_phone: clientPhone.trim(),
        design_data: {
          front: frontStateRef.current ? JSON.parse(frontStateRef.current) : [],
          back: backStateRef.current ? JSON.parse(backStateRef.current) : [],
        },
        front_preview_url: frontUrl.publicUrl,
        back_preview_url: backUrl.publicUrl,
      });

      if (error) throw error;

      // Also create an order automatically
      const { error: orderError } = await supabase.from('orders').insert({
        user_id: selectedTemplate.userId,
        client_id: selectedTemplate.userId, // placeholder - designer will assign client
        tracking_id: '',
        order_type: 'confeccao',
        paid: false,
        status: 'received',
      });

      toast.success('🎉 Design enviado com sucesso! O designer receberá seu pedido.');
      setSubmitOpen(false);
      setClientName('');
      setClientPhone('');
      setSelectedTemplate(null);
    } catch (err) {
      console.error(err);
      toast.error('Erro ao enviar design');
    }
    setSubmitting(false);
  };

  // Template selection screen
  if (!selectedTemplate) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="text-center mb-8">
            <img src={logo} alt="Macro Master" className="h-10 w-auto mx-auto mb-3" />
            <h1 className="text-2xl font-bold font-display">Editor de Camisas</h1>
            <p className="text-muted-foreground mt-1">Escolha um modelo para personalizar</p>
          </div>

          {loading ? (
            <p className="text-center text-muted-foreground">Carregando templates...</p>
          ) : templates.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <ImageIcon className="h-12 w-12 mx-auto mb-4 opacity-30" />
              <p className="text-lg font-medium">Nenhum template disponível</p>
              <p className="text-sm mt-1">O designer ainda não cadastrou modelos de camisa</p>
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

          <div className="text-center mt-8">
            <a href="/rastreio" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Rastrear um pedido →
            </a>
          </div>
        </div>
      </div>
    );
  }

  // Editor screen
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
        <Button onClick={() => setSubmitOpen(true)} className="gap-2">
          <Send className="h-4 w-4" /> Enviar Pedido
        </Button>
      </header>

      <div className="flex-1 flex flex-col lg:flex-row">
        {/* Toolbar */}
        <aside className="lg:w-72 border-b lg:border-b-0 lg:border-r border-border bg-card p-4 space-y-4 overflow-y-auto">
          {/* View switcher */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Visualização</p>
            <div className="flex gap-2">
              <Button
                variant={view === 'front' ? 'default' : 'outline'}
                size="sm"
                className="flex-1"
                onClick={() => switchView('front')}
              >
                Frente
              </Button>
              <Button
                variant={view === 'back' ? 'default' : 'outline'}
                size="sm"
                className="flex-1"
                onClick={() => switchView('back')}
              >
                Costas
              </Button>
            </div>
          </div>

          {/* Add text */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Adicionar Texto</p>
            <div className="space-y-2">
              <Input
                value={textInput}
                onChange={e => setTextInput(e.target.value)}
                placeholder="Digite o texto..."
                onKeyDown={e => e.key === 'Enter' && addText()}
              />
              <div className="flex items-center gap-2">
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
                <Button size="sm" onClick={addText} disabled={!textInput.trim()} className="ml-auto h-7">
                  <Type className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </div>

          {/* Upload logo */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Sua Logo / Imagem</p>
            <label className="flex items-center gap-2 px-3 py-2 border border-dashed border-border rounded-lg cursor-pointer hover:border-primary/50 transition-colors">
              <Upload className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Enviar imagem</span>
              <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
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

        {/* Canvas area */}
        <div className="flex-1 flex items-center justify-center p-4 bg-muted/30">
          <div className="relative">
            <p className="text-center text-xs text-muted-foreground mb-2 font-medium uppercase tracking-wider">
              {view === 'front' ? 'Frente' : 'Costas'}
            </p>
            <div className="rounded-xl border border-border/50 shadow-lg overflow-hidden bg-background">
              <canvas ref={canvasRef} />
            </div>
          </div>
        </div>
      </div>

      {/* Submit dialog */}
      <Dialog open={submitOpen} onOpenChange={setSubmitOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Enviar Pedido</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Preencha seus dados para finalizar o pedido</p>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Seu Nome *</label>
              <Input value={clientName} onChange={e => setClientName(e.target.value)} placeholder="Nome completo" />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Telefone</label>
              <Input value={clientPhone} onChange={e => setClientPhone(e.target.value)} placeholder="(00) 00000-0000" />
            </div>
            <Button onClick={handleSubmit} disabled={submitting || !clientName.trim()} className="w-full gap-2">
              <Send className="h-4 w-4" />
              {submitting ? 'Enviando...' : 'Confirmar Pedido'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ShirtEditor;
