import { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Check, Undo2, X, Pencil, ZoomIn, ZoomOut, Maximize } from 'lucide-react';

interface PolygonDrawerProps {
  imageUrl: string;
  width: number;
  height: number;
  initialPoints?: { x: number; y: number }[] | null;
  onSave: (points: { x: number; y: number }[]) => void;
  onCancel: () => void;
  onClear: () => void;
}

const PolygonDrawer = ({ imageUrl, width, height, initialPoints, onSave, onCancel, onClear }: PolygonDrawerProps) => {
  const [points, setPoints] = useState<{ x: number; y: number }[]>(initialPoints || []);
  const [hoveredPoint, setHoveredPoint] = useState<number | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const svgRef = useRef<SVGSVGElement>(null);

  const getPercent = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current) return { x: 0, y: 0 };
    const rect = svgRef.current.getBoundingClientRect();
    return {
      x: Math.round(((e.clientX - rect.left) / rect.width) * 1000) / 10,
      y: Math.round(((e.clientY - rect.top) / rect.height) * 1000) / 10,
    };
  }, []);

  const handleClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (isPanning) return;
    if ((e.target as Element).closest('.point-handle')) return;
    const pt = getPercent(e);
    setPoints(prev => [...prev, pt]);
  };

  const handleUndo = () => {
    setPoints(prev => prev.slice(0, -1));
  };

  const handleSave = () => {
    if (points.length < 3) return;
    onSave(points);
  };

  // Drag point
  const [dragging, setDragging] = useState<number | null>(null);
  const handlePointMouseDown = (i: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setDragging(i);
  };

  const handleMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (dragging === null) return;
    const pt = getPercent(e);
    setPoints(prev => prev.map((p, i) => i === dragging ? pt : p));
  }, [dragging, getPercent]);

  const handleMouseUp = () => {
    setDragging(null);
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

  const polyString = points.map(p => `${(p.x / 100) * width},${(p.y / 100) * height}`).join(' ');

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm">
        <Pencil className="h-4 w-4 text-primary" />
        <span className="font-medium">Modo Contorno</span>
        <span className="text-muted-foreground text-xs">— Clique para adicionar pontos</span>
      </div>

      <div className="flex items-center gap-1">
        <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setZoom(z => Math.min(4, z + 0.25))}>
          <ZoomIn className="h-3.5 w-3.5" />
        </Button>
        <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setZoom(z => Math.max(0.5, z - 0.25))}>
          <ZoomOut className="h-3.5 w-3.5" />
        </Button>
        <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}>
          <Maximize className="h-3.5 w-3.5" />
        </Button>
        <span className="text-[10px] text-muted-foreground ml-1">{Math.round(zoom * 100)}%</span>
      </div>

      <div
        className="border border-primary/50 rounded-lg overflow-hidden"
        style={{ width, height, cursor: isPanning ? 'grabbing' : 'crosshair' }}
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
            width,
            height,
            position: 'relative',
          }}
        >
      <div className="relative" style={{ width, height }}>
        <img
          src={imageUrl}
          alt="template"
          className="w-full h-full object-contain pointer-events-none absolute inset-0"
          draggable={false}
        />
        <svg
          ref={svgRef}
          width={width}
          height={height}
          className="absolute inset-0 cursor-crosshair"
          onClick={handleClick}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          {/* Filled polygon */}
          {points.length >= 3 && (
            <polygon
              points={polyString}
              fill="rgba(59,130,246,0.15)"
              stroke="rgba(59,130,246,0.8)"
              strokeWidth="2"
              strokeDasharray="6,3"
            />
          )}
          {/* Lines between points */}
          {points.length >= 2 && points.map((p, i) => {
            const next = points[(i + 1) % points.length];
            if (i === points.length - 1 && points.length < 3) return null;
            const x1 = (p.x / 100) * width;
            const y1 = (p.y / 100) * height;
            const x2 = (next.x / 100) * width;
            const y2 = (next.y / 100) * height;
            return (
              <line key={`l-${i}`} x1={x1} y1={y1} x2={x2} y2={y2}
                stroke="rgba(59,130,246,0.6)" strokeWidth="1.5" strokeDasharray="4,2" />
            );
          })}
          {/* Open line from last to first when < 3 pts */}
          {points.length === 2 && (
            <line
              x1={(points[0].x / 100) * width} y1={(points[0].y / 100) * height}
              x2={(points[1].x / 100) * width} y2={(points[1].y / 100) * height}
              stroke="rgba(59,130,246,0.6)" strokeWidth="1.5"
            />
          )}
          {/* Point handles */}
          {points.map((p, i) => {
            const cx = (p.x / 100) * width;
            const cy = (p.y / 100) * height;
            return (
              <circle
                key={i}
                className="point-handle"
                cx={cx}
                cy={cy}
                r={hoveredPoint === i || dragging === i ? 6 : 4}
                fill={i === 0 ? 'rgba(34,197,94,0.9)' : 'rgba(59,130,246,0.9)'}
                stroke="white"
                strokeWidth="2"
                style={{ cursor: 'grab' }}
                onMouseDown={(e) => handlePointMouseDown(i, e)}
                onMouseEnter={() => setHoveredPoint(i)}
                onMouseLeave={() => setHoveredPoint(null)}
              />
            );
          })}
        </svg>
      </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button size="sm" variant="default" onClick={handleSave} disabled={points.length < 3} className="gap-1.5">
          <Check className="h-3.5 w-3.5" /> Salvar ({points.length} pts)
        </Button>
        <Button size="sm" variant="outline" onClick={handleUndo} disabled={points.length === 0} className="gap-1.5">
          <Undo2 className="h-3.5 w-3.5" /> Desfazer
        </Button>
        <Button size="sm" variant="ghost" onClick={onClear} className="gap-1.5 text-destructive">
          <X className="h-3.5 w-3.5" /> Limpar contorno
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel} className="ml-auto">
          Fechar
        </Button>
      </div>

      <p className="text-[10px] text-muted-foreground">
        {points.length < 3
          ? `Clique ao menos 3 pontos para formar o contorno. (${points.length}/3 mínimo)`
          : `Contorno com ${points.length} pontos. Arraste os pontos para ajustar. O ponto verde é o início. Scroll para zoom · Alt+Arraste para mover a vista.`
        }
      </p>
    </div>
  );
};

export default PolygonDrawer;
