import { useState, useEffect, useRef } from 'react';
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
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!baseUrl || !canvasRef.current) {
      setReady(false);
      setDataUrl(null);
      return;
    }
    const delay = layers.length > 0 ? 220 : 0;
    const timer = window.setTimeout(() => {
      composeUvTexture({
        baseUrl, zones, layers, uvWidth, uvHeight,
        canvas: canvasRef.current!,
      }).then(() => {
        if (cancelled) return;
        // Converte para dataURL — resolve canvas tainted no mobile
        try {
          const url = canvasRef.current!.toDataURL('image/png');
          setDataUrl(url);
        } catch (e) {
          console.warn('toDataURL failed, using canvas directly', e);
        }
        setReady(true);
        setVersion(v => v + 1);
      }).catch(err => console.warn('UV composite failed', err));
    }, delay);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [baseUrl, zones, layers, uvWidth, uvHeight]);

  return { canvas: canvasRef.current, dataUrl, version, ready };
}