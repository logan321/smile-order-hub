import { useEffect, useRef, useState } from 'react';
import { composeUvTexture, UvLayer } from '@/lib/uvCompositor';
import type { UvZone } from '@/hooks/useUvLibrary';

interface Options {
  baseUrl: string | null | undefined;
  zones: Record<string, UvZone>;
  layers: UvLayer[];
  uvWidth?: number | null;
  uvHeight?: number | null;
}

export function useUvCompositor({ baseUrl, zones, layers, uvWidth, uvHeight }: Options) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  if (!canvasRef.current && typeof document !== 'undefined') {
    canvasRef.current = document.createElement('canvas');
  }
  const [version, setVersion] = useState(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!baseUrl || !canvasRef.current) { setReady(false); return; }
    composeUvTexture({
      baseUrl, zones, layers, uvWidth, uvHeight,
      canvas: canvasRef.current,
    }).then(() => {
      if (cancelled) return;
      setReady(true);
      setVersion(v => v + 1);
    }).catch(err => {
      console.warn('UV composite failed', err);
    });
    return () => { cancelled = true; };
  }, [baseUrl, zones, layers, uvWidth, uvHeight]);

  return { canvas: canvasRef.current, version, ready };
}