import { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Trash2, Plus, Save } from 'lucide-react';
import { toast } from 'sonner';
import type { UvZone } from '@/hooks/useUvLibrary';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  imageUrl: string;
  code: string;
  initialZones: Record<string, UvZone>;
  initialWidth: number | null;
  initialHeight: number | null;
  onSave: (zones: Record<string, UvZone>, dims: { width: number; height: number }) => Promise<void>;
}

type Drag =
  | { kind: 'move'; key: string; startX: number; startY: number; orig: UvZone }
  | { kind: 'resize'; key: string; startX: number; startY: number; orig: UvZone }
  | null;

const DEFAULT_KEYS = ['name_back', 'number_back', 'chest_right', 'chest_left', 'sleeve_left', 'sleeve_right'];

export default function UvZoneAdminEditor({ open, onOpenChange, imageUrl, code, initialZones, initialWidth, initialHeight, onSave }: Props) {
  const [zones, setZones] = useState<Record<string, UvZone>>(initialZones);
  const [dims, setDims] = useState<{ w: number; h: number }>({ w: initialWidth ?? 0, h: initialHeight ?? 0 });
  const [newKey, setNewKey] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<Drag>(null);

  useEffect(() => {
    if (open) {
      setZones(initialZones || {});
      setDims({ w: initialWidth ?? 0, h: initialHeight ?? 0 });
      setSelected(null);
    }
  }, [open, initialZones, initialWidth, initialHeight]);

  const onImgLoad = () => {
    if (imgRef.current && (!dims.w || !dims.h)) {
      setDims({ w: imgRef.current.naturalWidth, h: imgRef.current.naturalHeight });
    }
  };

  const getScale = () => {
    if (!imgRef.current) return 1;
    return imgRef.current.clientWidth / (dims.w || imgRef.current.naturalWidth || 1);
  };

  const screenToUv = (clientX: number, clientY: number) => {
    const rect = imgRef.current!.getBoundingClientRect();
    const s = getScale();
    return { x: (clientX - rect.left) / s, y: (clientY - rect.top) / s };
  };

  const startDrag = (key: string, e: React.PointerEvent, kind: 'move' | 'resize') => {
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    const pt = screenToUv(e.clientX, e.clientY);
    dragRef.current = { kind, key, startX: pt.x, startY: pt.y, orig: { ...zones[key] } };
    setSelected(key);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const pt = screenToUv(e.clientX, e.clientY);
    const dx = pt.x - d.startX;
    const dy = pt.y - d.startY;
    setZones(prev => {
      const z = { ...d.orig };
      if (d.kind === 'move') {
        z.x = Math.max(0, Math.min(dims.w - z.width, d.orig.x + dx));
        z.y = Math.max(0, Math.min(dims.h - z.height, d.orig.y + dy));
      } else {
        z.width = Math.max(20, d.orig.width + dx);
        z.height = Math.max(20, d.orig.height + dy);
      }
      return { ...prev, [d.key]: z };
    });
  };

  const endDrag = () => { dragRef.current = null; };

  const addZone = (key: string) => {
    if (!key.trim()) { toast.error('Nome da zona obrigatório'); return; }
    if (zones[key]) { toast.error('Já existe zona com esse nome'); return; }
    const w = dims.w || 1000;
    const h = dims.h || 1000;
    const size = Math.min(w, h) * 0.15;
    setZones(prev => ({ ...prev, [key]: { x: w / 2 - size / 2, y: h / 2 - size / 2, width: size, height: size * 0.5 } }));
    setSelected(key);
    setNewKey('');
  };

  const removeZone = (key: string) => {
    setZones(prev => { const n = { ...prev }; delete n[key]; return n; });
    if (selected === key) setSelected(null);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // round
      const rounded: Record<string, UvZone> = {};
      Object.entries(zones).forEach(([k, z]) => {
        rounded[k] = { x: Math.round(z.x), y: Math.round(z.y), width: Math.round(z.width), height: Math.round(z.height) };
      });
      await onSave(rounded, { width: dims.w, height: dims.h });
      toast.success('Zonas UV salvas');
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao salvar');
    }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl w-[95vw] max-h-[95vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Zonas UV — {code}</DialogTitle>
        </DialogHeader>
        <div className="grid lg:grid-cols-[1fr_320px] gap-4">
          <div
            ref={containerRef}
            className="relative bg-muted/30 rounded-lg overflow-hidden select-none"
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerLeave={endDrag}
          >
            <img
              ref={imgRef}
              src={imageUrl}
              alt={code}
              onLoad={onImgLoad}
              className="w-full h-auto block"
              draggable={false}
            />
            {Object.entries(zones).map(([key, z]) => {
              const s = getScale();
              const isSel = selected === key;
              return (
                <div
                  key={key}
                  onPointerDown={(e) => startDrag(key, e, 'move')}
                  className={`absolute border-2 ${isSel ? 'border-amber-500 bg-amber-500/20' : 'border-primary bg-primary/10'} cursor-move`}
                  style={{ left: z.x * s, top: z.y * s, width: z.width * s, height: z.height * s }}
                >
                  <span className="absolute top-0 left-0 -translate-y-full text-xs font-semibold bg-background/90 px-1.5 py-0.5 rounded">
                    {key}
                  </span>
                  <div
                    onPointerDown={(e) => startDrag(key, e, 'resize')}
                    className="absolute bottom-0 right-0 w-4 h-4 bg-amber-500 cursor-se-resize"
                  />
                </div>
              );
            })}
          </div>

          <div className="space-y-3">
            <div className="text-xs text-muted-foreground">
              UV: {dims.w} × {dims.h} px
            </div>

            <div className="space-y-2">
              <Label>Adicionar zona</Label>
              <div className="flex gap-1 flex-wrap">
                {DEFAULT_KEYS.filter(k => !zones[k]).map(k => (
                  <Button key={k} size="sm" variant="outline" className="h-7 text-xs" onClick={() => addZone(k)}>
                    + {k}
                  </Button>
                ))}
              </div>
              <div className="flex gap-1">
                <Input value={newKey} onChange={e => setNewKey(e.target.value)} placeholder="custom_name" className="h-8" />
                <Button size="sm" onClick={() => addZone(newKey.trim())}><Plus className="h-4 w-4" /></Button>
              </div>
            </div>

            <div className="space-y-1 max-h-[40vh] overflow-y-auto">
              {Object.entries(zones).map(([key, z]) => (
                <div
                  key={key}
                  onClick={() => setSelected(key)}
                  className={`p-2 rounded border text-xs cursor-pointer ${selected === key ? 'border-amber-500 bg-amber-500/10' : 'border-border'}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">{key}</span>
                    <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-destructive" onClick={(e) => { e.stopPropagation(); removeZone(key); }}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-4 gap-1 mt-1">
                    {(['x', 'y', 'width', 'height'] as const).map(prop => (
                      <input
                        key={prop}
                        type="number"
                        value={Math.round(z[prop])}
                        onChange={(e) => {
                          const v = Number(e.target.value);
                          setZones(prev => ({ ...prev, [key]: { ...prev[key], [prop]: v } }));
                        }}
                        className="border rounded px-1 py-0.5 text-[10px] w-full bg-background"
                        title={prop}
                      />
                    ))}
                  </div>
                </div>
              ))}
              {Object.keys(zones).length === 0 && (
                <p className="text-xs text-muted-foreground p-3 text-center">Nenhuma zona ainda. Adicione uma acima.</p>
              )}
            </div>

            <Button onClick={handleSave} disabled={saving} className="w-full">
              <Save className="h-4 w-4 mr-2" />
              {saving ? 'Salvando...' : 'Salvar zonas UV'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}