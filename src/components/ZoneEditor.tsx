import { useState, useRef, useCallback } from 'react';
import { useTemplateZones, TemplateZone } from '@/hooks/useTemplateZones';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Trash2, Move, X } from 'lucide-react';
import { toast } from 'sonner';

interface ZoneEditorProps {
  templateId: string;
  frontImageUrl: string;
  backImageUrl: string;
  onClose: () => void;
}

const PREVIEW_WIDTH = 360;
const PREVIEW_HEIGHT = 450;

const ZONE_COLORS = [
  'rgba(239,68,68,0.35)',
  'rgba(59,130,246,0.35)',
  'rgba(34,197,94,0.35)',
  'rgba(234,179,8,0.35)',
  'rgba(168,85,247,0.35)',
  'rgba(236,72,153,0.35)',
  'rgba(20,184,166,0.35)',
  'rgba(249,115,22,0.35)',
];

const ZoneEditor = ({ templateId, frontImageUrl, backImageUrl, onClose }: ZoneEditorProps) => {
  const { zones, loading, addZone, updateZone, deleteZone } = useTemplateZones(templateId);
  const [activeSide, setActiveSide] = useState<'front' | 'back'>('front');
  const [newZoneName, setNewZoneName] = useState('');
  const [dragging, setDragging] = useState<string | null>(null);
  const [dragStart, setDragStart] = useState<{ x: number; y: number; zoneX: number; zoneY: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const filteredZones = zones.filter(z => z.side === activeSide);
  const imageUrl = activeSide === 'front' ? frontImageUrl : backImageUrl;

  const handleAddZone = async () => {
    if (!newZoneName.trim()) return;
    await addZone(newZoneName.trim(), activeSide);
    setNewZoneName('');
    toast.success('Zona adicionada!');
  };

  const handleDeleteZone = async (id: string) => {
    if (confirm('Remover esta zona?')) {
      await deleteZone(id);
      toast.success('Zona removida!');
    }
  };

  const getMousePercent = useCallback((e: React.MouseEvent) => {
    if (!containerRef.current) return { x: 0, y: 0 };
    const rect = containerRef.current.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: ((e.clientY - rect.top) / rect.height) * 100,
    };
  }, []);

  const handleMouseDown = (e: React.MouseEvent, zone: TemplateZone) => {
    e.preventDefault();
    e.stopPropagation();
    const pos = getMousePercent(e);
    setDragging(zone.id);
    setDragStart({ x: pos.x, y: pos.y, zoneX: zone.xPercent, zoneY: zone.yPercent });
  };

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging || !dragStart) return;
    const pos = getMousePercent(e);
    const dx = pos.x - dragStart.x;
    const dy = pos.y - dragStart.y;
    const newX = Math.max(0, Math.min(90, dragStart.zoneX + dx));
    const newY = Math.max(0, Math.min(90, dragStart.zoneY + dy));

    // Optimistic UI update - find zone and update locally
    updateZone(dragging, { xPercent: Math.round(newX * 10) / 10, yPercent: Math.round(newY * 10) / 10 });
  }, [dragging, dragStart, getMousePercent, updateZone]);

  const handleMouseUp = () => {
    setDragging(null);
    setDragStart(null);
  };

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div>
            <h2 className="text-lg font-semibold font-display">Editor de Zonas</h2>
            <p className="text-sm text-muted-foreground">Defina as áreas onde logos e textos serão posicionados</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="p-4 flex flex-col lg:flex-row gap-4">
          {/* Image preview with zones */}
          <div className="flex-1">
            {/* Side toggle */}
            <div className="flex gap-2 mb-3">
              <Button
                variant={activeSide === 'front' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setActiveSide('front')}
              >
                Frente
              </Button>
              <Button
                variant={activeSide === 'back' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setActiveSide('back')}
              >
                Costas
              </Button>
            </div>

            {/* Image + zone overlays */}
            <div
              ref={containerRef}
              className="relative border border-border rounded-lg overflow-hidden bg-muted/30 select-none"
              style={{ width: PREVIEW_WIDTH, height: PREVIEW_HEIGHT }}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            >
              <img
                src={imageUrl}
                alt={activeSide}
                className="w-full h-full object-contain pointer-events-none"
                draggable={false}
              />

              {/* Zone overlays */}
              {filteredZones.map((zone, i) => (
                <div
                  key={zone.id}
                  className="absolute border-2 border-dashed rounded cursor-move flex items-center justify-center"
                  style={{
                    left: `${zone.xPercent}%`,
                    top: `${zone.yPercent}%`,
                    width: `${zone.widthPercent}%`,
                    height: `${zone.heightPercent}%`,
                    backgroundColor: ZONE_COLORS[i % ZONE_COLORS.length],
                    borderColor: ZONE_COLORS[i % ZONE_COLORS.length].replace('0.35', '0.8'),
                  }}
                  onMouseDown={(e) => handleMouseDown(e, zone)}
                >
                  <span className="text-[10px] font-bold text-foreground bg-background/80 px-1.5 py-0.5 rounded shadow-sm whitespace-nowrap">
                    {zone.name}
                  </span>
                </div>
              ))}
            </div>

            <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
              <Move className="h-3 w-3" /> Arraste as zonas para reposicionar
            </p>
          </div>

          {/* Zone list + controls */}
          <div className="lg:w-64 space-y-3">
            <div>
              <p className="text-sm font-semibold mb-2">Zonas ({activeSide === 'front' ? 'Frente' : 'Costas'})</p>

              {loading ? (
                <p className="text-xs text-muted-foreground">Carregando...</p>
              ) : filteredZones.length === 0 ? (
                <p className="text-xs text-muted-foreground py-4">Nenhuma zona definida para este lado.</p>
              ) : (
                <div className="space-y-2">
                  {filteredZones.map((zone, i) => (
                    <div key={zone.id} className="rounded-lg border border-border/50 bg-muted/20 p-2.5 space-y-2">
                      <div className="flex items-center gap-2">
                        <div
                          className="h-3 w-3 rounded-sm flex-shrink-0"
                          style={{ backgroundColor: ZONE_COLORS[i % ZONE_COLORS.length] }}
                        />
                        <Input
                          value={zone.name}
                          onChange={e => updateZone(zone.id, { name: e.target.value })}
                          className="h-7 text-xs flex-1"
                        />
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleDeleteZone(zone.id)}>
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </Button>
                      </div>

                      <div className="grid grid-cols-2 gap-1.5">
                        <div>
                          <label className="text-[10px] text-muted-foreground">X %</label>
                          <Input
                            type="number"
                            value={zone.xPercent}
                            onChange={e => updateZone(zone.id, { xPercent: Number(e.target.value) })}
                            className="h-6 text-[10px]"
                            min={0} max={100} step={1}
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-muted-foreground">Y %</label>
                          <Input
                            type="number"
                            value={zone.yPercent}
                            onChange={e => updateZone(zone.id, { yPercent: Number(e.target.value) })}
                            className="h-6 text-[10px]"
                            min={0} max={100} step={1}
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-muted-foreground">Largura %</label>
                          <Input
                            type="number"
                            value={zone.widthPercent}
                            onChange={e => updateZone(zone.id, { widthPercent: Number(e.target.value) })}
                            className="h-6 text-[10px]"
                            min={5} max={100} step={1}
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-muted-foreground">Altura %</label>
                          <Input
                            type="number"
                            value={zone.heightPercent}
                            onChange={e => updateZone(zone.id, { heightPercent: Number(e.target.value) })}
                            className="h-6 text-[10px]"
                            min={5} max={100} step={1}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Add new zone */}
            <div className="border-t border-border/50 pt-3 space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase">Adicionar Zona</p>
              <Input
                value={newZoneName}
                onChange={e => setNewZoneName(e.target.value)}
                placeholder="Ex: Peito Esquerdo"
                className="h-8 text-sm"
                onKeyDown={e => e.key === 'Enter' && handleAddZone()}
              />
              <Button size="sm" onClick={handleAddZone} disabled={!newZoneName.trim()} className="w-full gap-2">
                <Plus className="h-3.5 w-3.5" /> Adicionar Zona
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ZoneEditor;
