import { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Trash2, Plus, Save, RotateCcw } from 'lucide-react';
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

const ZONE_GROUPS = [
  {
    title: "Nome",
    prefix: "nome_",
    options: [
      { label: "Peito Direito", id: "peito_direito" },
      { label: "Peito Esquerdo", id: "peito_esquerdo" },
      { label: "Costas Cima", id: "costas_cima" },
      { label: "Costas Baixo", id: "costas_baixo" },
    ]
  },
  {
    title: "Número",
    prefix: "numero_",
    options: [
      { label: "Peito Direito", id: "peito_direito" },
      { label: "Peito Esquerdo", id: "peito_esquerdo" },
      { label: "Peito Centro", id: "peito_centro" },
      { label: "Costas Centro", id: "costas_centro" },
    ]
  },
  {
    title: "Escudo / Logo",
    prefix: "escudo_",
    options: [
      { label: "Peito Direito", id: "peito_direito" },
      { label: "Peito Esquerdo", id: "peito_esquerdo" },
      { label: "Ombro Esquerdo", id: "ombro_esquerdo" },
      { label: "Centro", id: "centro" },
    ]
  },
  {
    title: "Patrocínio",
    prefix: "patrocinio_",
    options: [
      { label: "Peito Direito", id: "peito_direito" },
      { label: "Peito Esquerdo", id: "peito_esquerdo" },
      { label: "Manga Esquerda", id: "manga_esquerda" },
      { label: "Manga Direita", id: "manga_direita" },
    ]
  },
  {
    title: "Texto Livre",
    prefix: "texto_",
    options: [
      { label: "Peito", id: "peito" },
      { label: "Costas", id: "costas" },
      { label: "Manga", id: "manga" },
    ]
  }
];

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
    
    // If a zone with this key already exists, just select it
    if (zones[key]) {
      setSelected(key);
      return;
    }

    const w = dims.w || 1000;
    const h = dims.h || 1000;
    const size = Math.min(w, h) * 0.15;
    setZones(prev => ({ ...prev, [key]: { x: w / 2 - size / 2, y: h / 2 - size / 2, width: size, height: size * 0.5 } }));
    setSelected(key);
    setNewKey('');
  };

  const renameZone = (oldKey: string, newKey: string) => {
    if (!newKey.trim() || oldKey === newKey) return;
    if (zones[newKey]) {
      toast.error('Já existe uma zona com esse nome');
      return;
    }
    setZones(prev => {
      const n = { ...prev };
      n[newKey] = n[oldKey];
      delete n[oldKey];
      return n;
    });
    setSelected(newKey);
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

            <div className="space-y-4 py-2 border-t border-b border-border/50">
              <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Definir tipo da zona</div>
              
              {ZONE_GROUPS.map((group) => (
                <div key={group.title} className="space-y-1.5">
                  <div className="text-[9px] font-bold text-gray-400 uppercase">{group.title}</div>
                  <div className="flex gap-1.5 flex-wrap">
                    {group.options.map(opt => {
                      const fullId = group.prefix + opt.id;
                      const isActive = selected === fullId;
                      return (
                        <Button 
                          key={fullId} 
                          size="sm" 
                          variant={isActive ? "default" : "secondary"}
                          className={`h-7 text-[10px] px-2.5 rounded-md transition-all ${
                            isActive 
                              ? 'bg-[#FF5A00] hover:bg-[#FF5A00]/90 text-white shadow-sm' 
                              : 'bg-gray-100 hover:bg-gray-200 text-gray-600'
                          }`}
                          onClick={() => {
                            if (selected && !zones[fullId]) {
                              renameZone(selected, fullId);
                            } else {
                              addZone(fullId);
                            }
                          }}
                        >
                          {opt.label}
                        </Button>
                      );
                    })}
                  </div>
                </div>
              ))}

              <div className="space-y-1.5 pt-1">
                <div className="text-[9px] font-bold text-gray-400 uppercase">Personalizado</div>
                <div className="flex gap-1.5">
                  <Input 
                    value={newKey} 
                    onChange={e => setNewKey(e.target.value)} 
                    placeholder="ID da zona" 
                    className="h-8 text-xs bg-gray-50 border-gray-200" 
                  />
                  <Button 
                    size="sm" 
                    className="h-8 px-3 bg-[#FF5A00] hover:bg-[#FF5A00]/90"
                    onClick={() => {
                      if (selected && newKey.trim() && !zones[newKey.trim()]) {
                        renameZone(selected, newKey.trim());
                        setNewKey('');
                      } else {
                        addZone(newKey.trim());
                      }
                    }}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            <div className="space-y-1 max-h-[40vh] overflow-y-auto">
              <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Zonas Criadas</div>
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