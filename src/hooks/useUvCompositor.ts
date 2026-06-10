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
const corsUrlCache = new Set<string>();
function toCorsUrl(url: string): string {
  // Use our proxy as the primary way to bypass CORS
  const proxied = toProxyUrl(url);
  
  // If the image already comes from our proxy, don't add extra cache-bust unless it's a new request
  if (corsUrlCache.has(proxied)) return proxied;
  corsUrlCache.add(proxied);
  
  const sep = proxied.includes('?') ? '&' : '?';
  // Cache-bust helps "clear" CORS state in mobile Safari/Chrome
  return `${proxied}${sep}cb=${Date.now()}`;
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
    if (!baseUrl || !canvasRef.current) {
      setReady(false);
      return;
    }
    const delay = layers.length > 0 ? 220 : 0;
    const timer = window.setTimeout(() => {
      // Usa URL com cache-bust para evitar canvas tainted no mobile
      const safeUrl = toCorsUrl(baseUrl);
      composeUvTexture({
        baseUrl,
        zones,
        layers,
        uvWidth: uvWidth ? Math.min(uvWidth, 2048) : null,
        uvHeight: uvHeight ? Math.min(uvHeight, 2048) : null,
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
          uvWidth,
          uvHeight,
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