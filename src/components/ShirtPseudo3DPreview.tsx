import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { RotateCw, Pause, Play, ChevronLeft, ChevronRight } from 'lucide-react';

interface ShirtPseudo3DPreviewProps {
  /** Ordered images representing rotation angles. Typically [front, rightSide, back, leftSide]. */
  angles: string[];
  /** Labels matching `angles` (optional, for accessibility / display). */
  labels?: string[];
}

/**
 * Pseudo-3D viewer: cycles between angle images with a smooth rotation animation
 * driven by drag, arrow buttons or auto-rotate. No WebGL — just CSS 3D + images.
 */
export default function ShirtPseudo3DPreview({ angles, labels }: ShirtPseudo3DPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [angle, setAngle] = useState(0); // degrees, free-form
  const [autoRotate, setAutoRotate] = useState(true);
  const dragging = useRef<{ startX: number; startAngle: number } | null>(null);

  const count = Math.max(angles.length, 1);
  const step = 360 / count;

  // Auto-rotate loop
  useEffect(() => {
    if (!autoRotate) return;
    let raf = 0;
    let last = performance.now();
    const tick = (t: number) => {
      const dt = (t - last) / 1000;
      last = t;
      setAngle((a) => a + dt * 30); // 30°/s
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [autoRotate]);

  // Drag handlers
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onDown = (clientX: number) => {
      setAutoRotate(false);
      dragging.current = { startX: clientX, startAngle: angle };
    };
    const onMove = (clientX: number) => {
      if (!dragging.current) return;
      const dx = clientX - dragging.current.startX;
      setAngle(dragging.current.startAngle + dx * 0.6);
    };
    const onUp = () => { dragging.current = null; };

    const md = (e: MouseEvent) => onDown(e.clientX);
    const mm = (e: MouseEvent) => onMove(e.clientX);
    const ts = (e: TouchEvent) => onDown(e.touches[0].clientX);
    const tm = (e: TouchEvent) => { if (dragging.current) { e.preventDefault(); onMove(e.touches[0].clientX); } };

    el.addEventListener('mousedown', md);
    window.addEventListener('mousemove', mm);
    window.addEventListener('mouseup', onUp);
    el.addEventListener('touchstart', ts, { passive: true });
    el.addEventListener('touchmove', tm, { passive: false });
    window.addEventListener('touchend', onUp);
    return () => {
      el.removeEventListener('mousedown', md);
      window.removeEventListener('mousemove', mm);
      window.removeEventListener('mouseup', onUp);
      el.removeEventListener('touchstart', ts);
      el.removeEventListener('touchmove', tm);
      window.removeEventListener('touchend', onUp);
    };
  }, [angle]);

  // Pick which angle index is currently most visible
  const norm = ((angle % 360) + 360) % 360;
  const currentIndex = Math.round(norm / step) % count;

  const goTo = (i: number) => {
    setAutoRotate(false);
    // shortest path to that angle
    const target = i * step;
    const delta = ((target - norm + 540) % 360) - 180;
    setAngle(angle + delta);
  };

  return (
    <div className="w-full h-full flex flex-col bg-gradient-to-b from-muted/40 to-muted rounded-lg overflow-hidden">
      <div
        ref={containerRef}
        className="flex-1 relative cursor-grab active:cursor-grabbing select-none touch-none"
        style={{ perspective: '1200px' }}
      >
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{ transformStyle: 'preserve-3d' }}
        >
          {angles.map((src, i) => {
            const faceAngle = i * step;
            return (
              <img
                key={i}
                src={src}
                alt={labels?.[i] ?? `Ângulo ${i + 1}`}
                draggable={false}
                className="absolute max-h-[85%] max-w-[85%] object-contain drop-shadow-xl"
                style={{
                  transform: `rotateY(${faceAngle - angle}deg) translateZ(220px)`,
                  backfaceVisibility: 'hidden',
                  transition: dragging.current ? 'none' : 'transform 60ms linear',
                }}
              />
            );
          })}
        </div>

        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 text-xs bg-background/80 backdrop-blur px-2 py-1 rounded-full text-muted-foreground">
          {labels?.[currentIndex] ?? `Ângulo ${currentIndex + 1}`}
        </div>
      </div>

      <div className="flex items-center justify-center gap-2 p-3 bg-background/60 border-t">
        <Button size="sm" variant="outline" onClick={() => goTo((currentIndex - 1 + count) % count)}>
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <Button size="sm" variant="outline" onClick={() => setAutoRotate((v) => !v)} className="gap-1">
          {autoRotate ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          {autoRotate ? 'Pausar' : 'Girar'}
        </Button>
        <Button size="sm" variant="outline" onClick={() => goTo((currentIndex + 1) % count)}>
          <ChevronRight className="w-4 h-4" />
        </Button>
        <Button size="sm" variant="ghost" onClick={() => { setAngle(0); setAutoRotate(true); }} className="gap-1">
          <RotateCw className="w-4 h-4" /> Reset
        </Button>
      </div>
    </div>
  );
}