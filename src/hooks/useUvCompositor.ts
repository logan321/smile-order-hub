import { useEffect, useRef, useState } from 'react';
import { composeUvTexture, UvLayer } from '@/lib/uvCompositor';
import type { UvZone } from '@/hooks/useUvLibrary';
import { supabase } from '@/integrations/supabase/client';

interface Options {
  baseUrl: string | null | undefined;
  zones: Record<string, UvZone>;
  layers: UvLayer[];
  uvWidth?: number | null;
  uvHeight?: number | null;
}

// Converte qualquer URL para blob URL local — resolve CORS no mobile
async function toBlobUrl(url: string): Promise<string> {
  try {
    const res = await fetch(url, { mode: 'cors', credentials: 'omit' });
    if (!res.ok) throw new Error(`fetch failed: ${res.status}`);
    const blob = await res.blob();
    return URL.createObjectURL(blob);
  } catch {
    return url; // fallback para URL original
  }
}

export function useUvCompositor({ baseUrl, zones, layers, uvWidth, uvHeight }: Options) {
  const canvasRef = useRef<HTMLCanvasElement | null>(
    typeof document !== 'undefined' ? document.createElement('canvas') : null
  );
  const [version, setVersion] = useState(0);
  const [ready, setReady] = useState(false);
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const blobUrlRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!baseUrl || !canvasRef.current) {
      setReady(false);
      setDataUrl(null);
      return;
    }

    const run = async () => {
      // Revoga blob URL anterior para liberar memória
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }

      // Converte para blob URL local — sem CORS no canvas
      const safeUrl = await toBlobUrl(baseUrl);
      if (cancelled) return;
      if (safeUrl !== baseUrl) blobUrlRef.current = safeUrl;

      try {
        await composeUvTexture({
          baseUrl: safeUrl,
          zones,
          layers,
          uvWidth,
          uvHeight,
          canvas: canvasRef.current!,
        });
        if (cancelled) return;

        // Exporta como dataUrl — funciona no Three.js mobile sem CORS
        const url = canvasRef.current!.toDataURL('image/png');
        setDataUrl(url);
        setReady(true);
        setVersion(v => v + 1);
      } catch (err) {
        console.warn('UV composite failed', err);
      }
    };

    const delay = layers.length > 0 ? 220 : 0;
    const timer = window.setTimeout(run, delay);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [baseUrl, zones, layers, uvWidth, uvHeight]);

  // Limpa blob URL ao desmontar
  useEffect(() => {
    return () => {
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
    };
  }, []);

  return { canvas: canvasRef.current, dataUrl, version, ready };
}