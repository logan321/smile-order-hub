import { useEffect, useRef, useState } from 'react';
import { composeUvTexture, UvLayer } from '@/lib/uvCompositor';
import type { UvZone } from '@/hooks/useUvLibrary';
import { toProxyUrl } from '@/lib/imageProxy';

interface Options {
  baseUrl: string | null | undefined;
  zones: Record<string, UvZone>;
  layers: UvLayer[];
  uvWidth?: number | null;
  uvHeight?: number | null;
}

// Força CORS adicionando cache-bust só na primeira vez por URL
const corsUrlCache = new Map<string, string>();
function toCorsUrl(url: string): string {
  if (!url) return '';
  const isMobile = typeof navigator !== 'undefined' && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  
  if (!isMobile) return toProxyUrl(url);

  // For mobile, we use a stable cache-bust per session or just once
  if (corsUrlCache.has(url)) return corsUrlCache.get(url)!;
  
  const proxied = toProxyUrl(url);
  const sep = proxied.includes('?') ? '&' : '?';
  const finalUrl = `${proxied}${sep}cb=${Math.floor(Date.now() / 1000)}`; 
  corsUrlCache.set(url, finalUrl);
  return finalUrl;
}

export function useUvCompositor({ baseUrl, zones, layers, uvWidth, uvHeight }: Options) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isMobile = typeof navigator !== 'undefined' && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

  if (!canvasRef.current && typeof document !== 'undefined') {
    canvasRef.current = document.createElement('canvas');
  }
  const [version, setVersion] = useState(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!baseUrl || !canvasRef.current) {
      setReady(false);
      return;
    }
    const delay = layers.length > 0 ? 220 : 0;
    const timer = window.setTimeout(() => {
      // Usa URL com cache-bust para evitar canvas tainted no mobile
      const safeUrl = toCorsUrl(baseUrl);
      composeUvTexture({
        baseUrl: safeUrl,
        zones,
        layers,
        uvWidth: isMobile ? 1024 : uvWidth,
        uvHeight: isMobile ? 1024 : uvHeight,
        canvas: canvasRef.current!,
      }).then(() => {
        if (cancelled) return;
        setReady(true);
        setVersion(v => v + 1);
      }).catch(err => {
        console.warn('UV composite failed', err);
        // Tenta sem cache-bust como fallback
        composeUvTexture({
          baseUrl,
          zones,
          layers,
          uvWidth: isMobile ? 1024 : uvWidth,
          uvHeight: isMobile ? 1024 : uvHeight,
          canvas: canvasRef.current!,
        }).then(() => {
          if (cancelled) return;
          setReady(true);
          setVersion(v => v + 1);
        }).catch(() => {});
      });
    }, delay);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [baseUrl, zones, layers, uvWidth, uvHeight]);

  return { canvas: canvasRef.current, version, ready };
}