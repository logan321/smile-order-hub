import { useState, useRef, useCallback, useEffect } from 'react';
import { useTemplateZones, TemplateZone } from '@/hooks/useTemplateZones';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Trash2, Move, X, Link, PenTool, RotateCw, ZoomIn, ZoomOut, Maximize, Fish } from 'lucide-react';
import { toast } from 'sonner';
import PolygonDrawer from '@/components/PolygonDrawer';

interface ZoneEditorProps {
  templateId: string;
  frontImageUrl: string;
  backImageUrl: string;
  onClose: () => void;
}

const PREVIEW_WIDTH = 480;
const PREVIEW_HEIGHT = 600;

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

type DragMode = 'move' | 'rotate' | 'resize-br' | 'resize-bl' | 'resize-tr' | 'resize-tl' | 'resize-r' | 'resize-l' | 'resize-t' | 'resize-b';

interface DragState {
  zoneId: string;
  mode: DragMode;
  startX: number;
  startY: number;
  origX: number;
  origY: number;
  origW: number;
  origH: number;
  origRotation: number;
}

const ZoneEditor = ({ templateId, frontImageUrl, backImageUrl, onClose }: ZoneEditorProps) => {
  const { zones, loading, addZone, updateZone, deleteZone } = useTemplateZones(templateId);
  const [activeSide, setActiveSide] = useState<'front' | 'back'>('front');
  const [newZoneName, setNewZoneName] = useState('');
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [localOverrides, setLocalOverrides] = useState<Record<string, Partial<TemplateZone>>>({});
  const [polygonEditZoneId, setPolygonEditZoneId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Show zones for active side + shared zones from the other side
  const filteredZones = zones.filter(z => z.side === activeSide || z.shared);
  const imageUrl = activeSide === 'front' ? frontImageUrl : backImageUrl;

  // Check if this zone is being shown on its opposite side (shared zone on the other side)
  const isBackSideOfShared = (zone: TemplateZone) => zone.shared && zone.side !== activeSide;

  // Merge DB zones with local drag overrides, using back_* coords when viewing back side of shared zone
  const getZoneDisplay = (zone: TemplateZone) => {
    const useBack = isBackSideOfShared(zone);
    const base = useBack ? {
      ...zone,
      xPercent: zone.backXPercent,
      yPercent: zone.backYPercent,
      widthPercent: zone.backWidthPercent,
      heightPercent: zone.backHeightPercent,
      rotation: zone.backRotation,
      pathData: zone.backPathData,
    } : zone;
    return {
      ...base,
      ...(localOverrides[zone.id] || {}),
    };
  };

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

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.15 : 0.15;
    setZoom(prev => Math.max(0.5, Math.min(4, prev + delta)));
  }, []);

  const handleWrapperMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.altKey) {
      e.preventDefault();
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  }, [pan]);

  const handleWrapperMouseMove = useCallback((e: React.MouseEvent) => {
    if (isPanning) {
      setPan({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
    }
  }, [isPanning, panStart]);

  const handleWrapperMouseUp = useCallback(() => {
    setIsPanning(false);
  }, []);

  const resetView = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  const getMousePercent = useCallback((e: MouseEvent | React.MouseEvent) => {
    if (!containerRef.current) return { x: 0, y: 0 };
    const rect = containerRef.current.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: ((e.clientY - rect.top) / rect.height) * 100,
    };
  }, []);

  const handleMouseDown = (e: React.MouseEvent, zone: TemplateZone, mode: DragMode) => {
    e.preventDefault();
    e.stopPropagation();
    const pos = getMousePercent(e);
    const display = getZoneDisplay(zone);
    setDragState({
      zoneId: zone.id,
      mode,
      startX: pos.x,
      startY: pos.y,
      origX: display.xPercent,
      origY: display.yPercent,
      origW: display.widthPercent,
      origH: display.heightPercent,
      origRotation: zone.rotation || 0,
    });
  };

  // Use window-level mouse events for smooth dragging
  useEffect(() => {
    if (!dragState) return;

    const handleMove = (e: MouseEvent) => {
      const pos = getMousePercent(e);
      const dx = pos.x - dragState.startX;
      const dy = pos.y - dragState.startY;
      const { mode, origX, origY, origW, origH, zoneId } = dragState;

      if (mode === 'rotate') {
        // Calculate angle from zone center to mouse position
        const centerX = origX + origW / 2;
        const centerY = origY + origH / 2;
        const startAngle = Math.atan2(dragState.startY - centerY, dragState.startX - centerX);
        const currentAngle = Math.atan2(pos.y - centerY, pos.x - centerX);
        const deltaAngle = ((currentAngle - startAngle) * 180) / Math.PI;
        const newRotation = Math.round(dragState.origRotation + deltaAngle);
        setLocalOverrides(prev => ({
          ...prev,
          [zoneId]: {
            ...(prev[zoneId] || {}),
            rotation: newRotation,
          },
        }));
        return;
      }

      let newX = origX, newY = origY, newW = origW, newH = origH;

      if (mode === 'move') {
        newX = origX + dx;
        newY = origY + dy;
      } else if (mode === 'resize-br') {
        newW = Math.max(5, origW + dx);
        newH = Math.max(5, origH + dy);
      } else if (mode === 'resize-r') {
        newW = Math.max(5, origW + dx);
      } else if (mode === 'resize-b') {
        newH = Math.max(5, origH + dy);
      } else if (mode === 'resize-bl') {
        newX = origX + dx;
        newW = Math.max(5, origW - dx);
        if (newW <= 5) newX = origX + origW - 5;
      } else if (mode === 'resize-l') {
        newX = origX + dx;
        newW = Math.max(5, origW - dx);
        if (newW <= 5) newX = origX + origW - 5;
      } else if (mode === 'resize-tr') {
        newY = origY + dy;
        newW = Math.max(5, origW + dx);
        newH = Math.max(5, origH - dy);
        if (newH <= 5) newY = origY + origH - 5;
      } else if (mode === 'resize-tl') {
        newX = origX + dx;
        newY = origY + dy;
        newW = Math.max(5, origW - dx);
        newH = Math.max(5, origH - dy);
        if (newW <= 5) newX = origX + origW - 5;
        if (newH <= 5) newY = origY + origH - 5;
      } else if (mode === 'resize-t') {
        newY = origY + dy;
        newH = Math.max(5, origH - dy);
        if (newH <= 5) newY = origY + origH - 5;
      }

      setLocalOverrides(prev => ({
        ...prev,
        [zoneId]: {
          xPercent: Math.round(newX * 10) / 10,
          yPercent: Math.round(newY * 10) / 10,
          widthPercent: Math.round(newW * 10) / 10,
          heightPercent: Math.round(newH * 10) / 10,
        },
      }));
    };

    const handleUp = () => {
      // Commit to DB - map to back_* fields if editing back side of shared zone
      const override = localOverrides[dragState.zoneId];
      if (override) {
        const zone = zones.find(z => z.id === dragState.zoneId);
        const useBack = zone && isBackSideOfShared(zone);
        if (useBack) {
          const mapped: any = {};
          if (override.xPercent !== undefined) mapped.backXPercent = override.xPercent;
          if (override.yPercent !== undefined) mapped.backYPercent = override.yPercent;
          if (override.widthPercent !== undefined) mapped.backWidthPercent = override.widthPercent;
          if (override.heightPercent !== undefined) mapped.backHeightPercent = override.heightPercent;
          if (override.rotation !== undefined) mapped.backRotation = override.rotation;
          updateZone(dragState.zoneId, mapped);
        } else {
          updateZone(dragState.zoneId, override);
        }
      }
      setDragState(null);
      // Clear overrides after a short delay to let DB update
      setTimeout(() => setLocalOverrides(prev => {
        const next = { ...prev };
        delete next[dragState.zoneId];
        return next;
      }), 200);
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [dragState, getMousePercent, localOverrides, updateZone]);

  const handleCornerCursor = (mode: DragMode) => {
    switch (mode) {
      case 'resize-br': case 'resize-tl': return 'nwse-resize';
      case 'resize-bl': case 'resize-tr': return 'nesw-resize';
      case 'resize-r': case 'resize-l': return 'ew-resize';
      case 'resize-t': case 'resize-b': return 'ns-resize';
      case 'rotate': return 'grab';
      default: return 'move';
    }
  };

  const HANDLE_SIZE = 8;

  const renderResizeHandles = (zone: TemplateZone, i: number) => {
    const display = getZoneDisplay(zone);
    const handles: { mode: DragMode; style: React.CSSProperties }[] = [
      { mode: 'resize-tl', style: { top: -HANDLE_SIZE / 2, left: -HANDLE_SIZE / 2 } },
      { mode: 'resize-tr', style: { top: -HANDLE_SIZE / 2, right: -HANDLE_SIZE / 2 } },
      { mode: 'resize-bl', style: { bottom: -HANDLE_SIZE / 2, left: -HANDLE_SIZE / 2 } },
      { mode: 'resize-br', style: { bottom: -HANDLE_SIZE / 2, right: -HANDLE_SIZE / 2 } },
      { mode: 'resize-t', style: { top: -HANDLE_SIZE / 2, left: '50%', marginLeft: -HANDLE_SIZE / 2 } },
      { mode: 'resize-b', style: { bottom: -HANDLE_SIZE / 2, left: '50%', marginLeft: -HANDLE_SIZE / 2 } },
      { mode: 'resize-l', style: { top: '50%', left: -HANDLE_SIZE / 2, marginTop: -HANDLE_SIZE / 2 } },
      { mode: 'resize-r', style: { top: '50%', right: -HANDLE_SIZE / 2, marginTop: -HANDLE_SIZE / 2 } },
    ];

    return handles.map(h => (
      <div
        key={h.mode}
        className="absolute bg-background border-2 rounded-sm z-10"
        style={{
          ...h.style,
          width: HANDLE_SIZE,
          height: HANDLE_SIZE,
          cursor: handleCornerCursor(h.mode),
          borderColor: ZONE_COLORS[i % ZONE_COLORS.length].replace('0.35', '0.9'),
        }}
        onMouseDown={e => handleMouseDown(e, zone, h.mode)}
      />
    ));
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

            {/* Zoom controls */}
            <div className="flex items-center gap-1 mb-2">
              <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setZoom(z => Math.min(4, z + 0.25))}>
                <ZoomIn className="h-3.5 w-3.5" />
              </Button>
              <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setZoom(z => Math.max(0.5, z - 0.25))}>
                <ZoomOut className="h-3.5 w-3.5" />
              </Button>
              <Button variant="outline" size="icon" className="h-7 w-7" onClick={resetView}>
                <Maximize className="h-3.5 w-3.5" />
              </Button>
              <span className="text-[10px] text-muted-foreground ml-1">{Math.round(zoom * 100)}%</span>
            </div>

            {/* Zoomable wrapper */}
            <div
              ref={wrapperRef}
              className="border border-border rounded-lg overflow-hidden bg-muted/30"
              style={{ width: PREVIEW_WIDTH, height: PREVIEW_HEIGHT, cursor: isPanning ? 'grabbing' : 'default' }}
              onWheel={handleWheel}
              onMouseDown={handleWrapperMouseDown}
              onMouseMove={handleWrapperMouseMove}
              onMouseUp={handleWrapperMouseUp}
              onMouseLeave={handleWrapperMouseUp}
            >
              <div
                style={{
                  transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                  transformOrigin: 'center center',
                  width: PREVIEW_WIDTH,
                  height: PREVIEW_HEIGHT,
                  position: 'relative',
                }}
              >
            {/* Image + zone overlays */}
            <div
              ref={containerRef}
              className="relative select-none"
              style={{ width: PREVIEW_WIDTH, height: PREVIEW_HEIGHT }}
            >
              <img
                src={imageUrl}
                alt={activeSide}
                className="w-full h-full object-contain pointer-events-none"
                draggable={false}
              />

              {/* Zone overlays with resize handles */}
              {filteredZones.map((zone, i) => {
                const display = getZoneDisplay(zone);
                const rotation = display.rotation ?? zone.rotation ?? 0;
                return (
                  <div
                    key={zone.id}
                    className="absolute border-2 border-dashed rounded flex items-center justify-center"
                    style={{
                      left: `${display.xPercent}%`,
                      top: `${display.yPercent}%`,
                      width: `${display.widthPercent}%`,
                      height: `${display.heightPercent}%`,
                      backgroundColor: ZONE_COLORS[i % ZONE_COLORS.length],
                      borderColor: ZONE_COLORS[i % ZONE_COLORS.length].replace('0.35', '0.8'),
                      cursor: 'move',
                      transform: `rotate(${rotation}deg)`,
                      transformOrigin: 'center center',
                    }}
                    onMouseDown={(e) => handleMouseDown(e, zone, 'move')}
                  >
                    <span className="text-[10px] font-bold text-foreground bg-background/80 px-1.5 py-0.5 rounded shadow-sm whitespace-nowrap pointer-events-none">
                      {zone.name} {rotation !== 0 ? `${rotation}°` : ''}
                    </span>
                    {renderResizeHandles(zone, i)}
                    {/* Rotation handle */}
                    <div
                      className="absolute flex flex-col items-center"
                      style={{ top: -28, left: '50%', marginLeft: -5 }}
                    >
                      <div
                        style={{ width: 1, height: 14, backgroundColor: ZONE_COLORS[i % ZONE_COLORS.length].replace('0.35', '0.8') }}
                      />
                      <div
                        className="rounded-full border-2 bg-background flex items-center justify-center"
                        style={{
                          width: 12,
                          height: 12,
                          cursor: 'grab',
                          borderColor: ZONE_COLORS[i % ZONE_COLORS.length].replace('0.35', '0.9'),
                          marginTop: -1,
                        }}
                        onMouseDown={e => handleMouseDown(e, zone, 'rotate')}
                      >
                        <RotateCw className="h-2 w-2" style={{ color: ZONE_COLORS[i % ZONE_COLORS.length].replace('0.35', '0.9') }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
              </div>
            </div>

            <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
              <Move className="h-3 w-3" /> Arraste para mover · Scroll para zoom · Alt+Arraste para mover a vista
            </p>

            {/* Polygon drawer for selected zone */}
            {polygonEditZoneId && (() => {
              const zone = zones.find(z => z.id === polygonEditZoneId);
              if (!zone) return null;
              const zoneImgUrl = zone.side === 'front' ? frontImageUrl : backImageUrl;
              return (
                <div className="mt-3 border-t border-border/50 pt-3">
                  <p className="text-xs font-semibold mb-2">Contorno: {zone.name}</p>
                  <PolygonDrawer
                    imageUrl={zoneImgUrl}
                    width={PREVIEW_WIDTH}
                    height={PREVIEW_HEIGHT}
                    initialPoints={zone.pathData}
                    onSave={(points) => {
                      updateZone(zone.id, { pathData: points });
                      setPolygonEditZoneId(null);
                      toast.success('Contorno salvo!');
                    }}
                    onCancel={() => setPolygonEditZoneId(null)}
                    onClear={() => {
                      updateZone(zone.id, { pathData: null as any });
                      setPolygonEditZoneId(null);
                      toast.success('Contorno removido');
                    }}
                  />
                </div>
              );
            })()}
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
                  {filteredZones.map((zone, i) => {
                    const display = getZoneDisplay(zone);
                    return (
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
                          <Button
                            variant="ghost"
                            size="icon"
                            className={`h-6 w-6 ${zone.pathData ? 'text-primary' : 'text-muted-foreground'}`}
                            title={zone.pathData ? 'Editar contorno personalizado' : 'Desenhar contorno personalizado'}
                            onClick={() => setPolygonEditZoneId(polygonEditZoneId === zone.id ? null : zone.id)}
                          >
                            <PenTool className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className={`h-6 w-6 ${zone.patchOnly ? 'text-orange-500' : 'text-muted-foreground'}`}
                            title={zone.patchOnly ? 'Exclusiva para peixes (clique para desativar)' : 'Marcar como exclusiva para peixes'}
                            onClick={() => updateZone(zone.id, { patchOnly: !zone.patchOnly })}
                          >
                            <Fish className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className={`h-6 w-6 ${zone.shared ? 'text-primary' : 'text-muted-foreground'}`}
                            title={zone.shared ? 'Compartilhada (frente e costas)' : 'Clique para compartilhar com ambos os lados'}
                            onClick={() => updateZone(zone.id, { shared: !zone.shared })}
                          >
                            <Link className="h-3 w-3" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleDeleteZone(zone.id)}>
                            <Trash2 className="h-3 w-3 text-destructive" />
                          </Button>
                        </div>
                        {zone.patchOnly && (
                          <p className="text-[10px] text-orange-500 font-medium">🐟 Exclusiva para peixes</p>
                        )}
                        {zone.shared && (
                          <p className="text-[10px] text-primary font-medium">🔗 Compartilhada frente/costas</p>
                        )}
                        {zone.pathData && (
                          <p className="text-[10px] text-primary font-medium">✏️ Contorno personalizado ({zone.pathData.length} pts)</p>
                        )}
                        {isBackSideOfShared(zone) && zone.backPathData && (
                          <p className="text-[10px] text-primary font-medium">✏️ Contorno costas ({zone.backPathData.length} pts)</p>
                        )}

                        <div className="grid grid-cols-2 gap-1.5">
                          <div>
                            <label className="text-[10px] text-muted-foreground">X %</label>
                            <Input
                              type="number"
                              value={display.xPercent}
                              onChange={e => {
                                const val = Number(e.target.value);
                                updateZone(zone.id, isBackSideOfShared(zone) ? { backXPercent: val } : { xPercent: val });
                              }}
                              className="h-6 text-[10px]"
                              min={0} max={100} step={1}
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-muted-foreground">Y %</label>
                            <Input
                              type="number"
                              value={display.yPercent}
                              onChange={e => {
                                const val = Number(e.target.value);
                                updateZone(zone.id, isBackSideOfShared(zone) ? { backYPercent: val } : { yPercent: val });
                              }}
                              className="h-6 text-[10px]"
                              min={0} max={100} step={1}
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-muted-foreground">Largura %</label>
                            <Input
                              type="number"
                              value={display.widthPercent}
                              onChange={e => {
                                const val = Number(e.target.value);
                                updateZone(zone.id, isBackSideOfShared(zone) ? { backWidthPercent: val } : { widthPercent: val });
                              }}
                              className="h-6 text-[10px]"
                              min={5} max={100} step={1}
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-muted-foreground">Altura %</label>
                            <Input
                              type="number"
                              value={display.heightPercent}
                              onChange={e => {
                                const val = Number(e.target.value);
                                updateZone(zone.id, isBackSideOfShared(zone) ? { backHeightPercent: val } : { heightPercent: val });
                              }}
                              className="h-6 text-[10px]"
                              min={5} max={100} step={1}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
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
