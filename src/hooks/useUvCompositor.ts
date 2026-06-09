import { useEffect, useRef, useState, useCallback } from 'react';
import { composeUvTexture, UvLayer } from '@/lib/uvCompositor';
import type { UvZone } from '@/hooks/useUvLibrary';

interface Options {
  baseUrl: string | null | undefined;
  zones: Record<string, UvZone>;
  layers: UvLayer[];
  uvWidth?: number | null;
  uvHeight?: number | null;
}

// Detecta mobile de forma confiável
const isMobile = () =>
  typeof navigator !== 'undefined' &&
  /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);

export function useUvCompositor({ baseUrl, zones, layers, uvWidth, uvHeight }: Options) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  if (!canvasRef.current && typeof document !== 'undefined') {
    canvasRef.current = document.createElement('canvas');
  }

  const [version, setVersion] = useState(0);
  const [ready, setReady] = useState(false);
  // No mobile usamos dataUrl em vez do canvas direto
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
        setReady(true);
        setVersion(v => v + 1);
        // No mobile exporta como dataUrl para garantir que o Three.js consiga ler
        if (isMobile()) {
          try {
            const url = canvasRef.current!.toDataURL('image/png');
            setDataUrl(url);
          } catch (e) {
            console.warn('toDataURL failed', e);
          }
        }
      }).catch(err => {
        console.warn('UV composite failed', err);
      });
    }, delay);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [baseUrl, zones, layers, uvWidth, uvHeight]);

  return {
    canvas: canvasRef.current,
    dataUrl,          // usar no mobile
    version,
    ready,
    isMobile: isMobile(),
  };
}
