import { useCallback, useEffect, useState } from 'react';
import { loadImage } from '@/lib/composeMockup';
import { toProxyUrl } from '@/lib/imageProxy';

export interface MobileUvZone {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  type: 'estampa' | 'escudo' | 'nome' | 'numero';
}

const UV_BASE_SILHOUETTE_URL = 'https://raw.githubusercontent.com/lovable-ai-temp/resources/main/shirt-silhouette-white.png';

export function useMobileUvCompositor() {
  const [uvCanvas, setUvCanvas] = useState<HTMLCanvasElement | null>(null);
  const [version, setVersion] = useState(0);

  const compose = useCallback(async (params: {
    stampUrl?: string | null;
    escudoUrl?: string | null;
    escudoScale?: number;
    escudoOffset?: { x: number; y: number };
    zones: MobileUvZone[];
    textElements: { id: string; text: string; zoneId: string; color: string; fontSize: number; fontFamily: string }[];
  }) => {
    const { stampUrl, escudoUrl, escudoScale = 1, escudoOffset = { x: 0, y: 0 }, zones, textElements } = params;
    
    // 1. Create Canvas
    const canvas = document.createElement('canvas');
    canvas.width = 2048; // High res for UV
    canvas.height = 2048;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 2. Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 3. Draw "Full Silhouette" as background if needed, or just fill with base color
    // But usually the UV of the stamp already has the shape.
    // If we want to treat stamp as "huge shield", we need a base.
    
    // 4. Draw Stamp (as giant shield on full-silhouette zone)
    const fullZone = zones.find(z => z.id === 'full-silhouette');
    if (fullZone && stampUrl) {
      try {
        const stampImg = await loadImage(toProxyUrl(stampUrl));
        const zX = (fullZone.x / 100) * canvas.width;
        const zY = (fullZone.y / 100) * canvas.height;
        const zW = (fullZone.width / 100) * canvas.width;
        const zH = (fullZone.height / 100) * canvas.height;
        
        ctx.drawImage(stampImg, zX, zY, zW, zH);
      } catch (e) {
        console.error('MobileCompositor: Failed to load stamp', e);
      }
    }

    // 5. Draw Escudo
    const escudoZone = zones.find(z => z.type === 'escudo');
    if (escudoZone && escudoUrl) {
      try {
        const escImg = await loadImage(toProxyUrl(escudoUrl));
        const zX = (escudoZone.x / 100) * canvas.width;
        const zY = (escudoZone.y / 100) * canvas.height;
        const zW = (escudoZone.width / 100) * canvas.width;
        const zH = (escudoZone.height / 100) * canvas.height;
        
        const finalW = zW * escudoScale;
        const finalH = (escImg.height / escImg.width) * finalW;
        
        const centerX = zX + zW / 2 + (escudoOffset.x / 100) * canvas.width;
        const centerY = zY + zH / 2 + (escudoOffset.y / 100) * canvas.height;
        
        ctx.drawImage(escImg, centerX - finalW / 2, centerY - finalH / 2, finalW, finalH);
      } catch (e) {
        console.error('MobileCompositor: Failed to load escudo', e);
      }
    }

    // 6. Draw Text Elements (Nome, Numero)
    for (const el of textElements) {
      const zone = zones.find(z => z.id === el.zoneId);
      if (!zone || !el.text) continue;

      const zX = (zone.x / 100) * canvas.width;
      const zY = (zone.y / 100) * canvas.height;
      const zW = (zone.width / 100) * canvas.width;
      const zH = (zone.height / 100) * canvas.height;

      ctx.save();
      ctx.fillStyle = el.color;
      // Approximation for mobile fonts
      const fontS = (el.fontSize / 100) * zH * 2; 
      ctx.font = `bold ${fontS}px ${el.fontFamily || 'Impact'}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      // Draw text centered in zone
      ctx.fillText(el.text.toUpperCase(), zX + zW / 2, zY + zH / 2);
      ctx.restore();
    }

    setUvCanvas(canvas);
    setVersion(v => v + 1);
  }, []);

  return { uvCanvas, version, compose };
}
