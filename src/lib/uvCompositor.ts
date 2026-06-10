import type { UvZone } from '@/hooks/useUvLibrary';

export type UvLayer =
  | {
      id: string;
      zoneKey: string;
      type: 'text';
      content: string;
      fontFamily?: string;
      fontWeight?: string | number;
      color?: string;
      strokeColor?: string;
      strokeWidth?: number;
      fontSize?: number;
      curvature?: number;
      align?: 'left' | 'center' | 'right';
      rotation?: number;
      scale?: number;
      offsetX?: number;
      offsetY?: number;
    }
  | {
      id: string;
      zoneKey: string;
      type: 'image';
      url: string;
      rotation?: number;
      scale?: number;
      offsetX?: number;
      offsetY?: number;
      opacity?: number;
    };

const imgCache = new Map<string, Promise<HTMLImageElement>>();
function loadImage(url: string): Promise<HTMLImageElement> {
  const cached = imgCache.get(url);
  if (cached) return cached;

  const p = new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    // Força crossOrigin anonymous para evitar Canvas Tainted
    img.crossOrigin = 'anonymous';
    
    img.onload = () => {
      // Small delay for mobile browsers to ensure the image data is actually accessible
      setTimeout(() => resolve(img), 10);
    };
    
    img.onerror = () => {
      console.warn('CORS loading failed for:', url, 'trying fallback without crossOrigin...');
      const img2 = new Image();
      img2.onload = () => resolve(img2);
      img2.onerror = (e) => {
        console.error('Final image load failed:', url, e);
        reject(e);
      };
      // Fallback: without crossOrigin. The canvas might become "tainted", but at least it renders.
      img2.src = url;
    };

    img.src = url;
  });

  imgCache.set(url, p);
  return p;
}

export async function composeUvTexture(opts: {
  baseUrl: string;
  uvWidth?: number | null;
  uvHeight?: number | null;
  zones: Record<string, UvZone>;
  layers: UvLayer[];
  canvas?: HTMLCanvasElement;
}): Promise<HTMLCanvasElement> {
  const base = await loadImage(opts.baseUrl);
  const w = opts.uvWidth || base.naturalWidth;
  const h = opts.uvHeight || base.naturalHeight;
  const canvas = opts.canvas ?? document.createElement('canvas');
  if (canvas.width !== w) canvas.width = w;
  if (canvas.height !== h) canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, w, h);
  ctx.drawImage(base, 0, 0, w, h);

  for (const layer of opts.layers) {
    const zone = opts.zones[layer.zoneKey];
    if (!zone && !layer.id.includes('applied_stamp')) continue;
    ctx.save();
    
    // Check if it's the escudo or a stamp layer to decide whether to clip
    const isEscudo = layer.id === 'layer_escudo';
    const isAppliedStamp = layer.id.includes('applied_stamp');
    
    if (!isEscudo && !isAppliedStamp && zone) {
      // Clip to zone for other layers
      ctx.beginPath();
      ctx.rect(zone.x, zone.y, zone.width, zone.height);
      ctx.clip();
    }
    
    let cx = 0;
    let cy = 0;
    
    if (isAppliedStamp) {
      cx = w / 2 + (layer.offsetX ?? 0);
      cy = h / 2 + (layer.offsetY ?? 0);
    } else if (zone) {
      cx = zone.x + zone.width / 2 + (layer.offsetX ?? 0);
      cy = zone.y + zone.height / 2 + (layer.offsetY ?? 0);
    }
    
    ctx.translate(cx, cy);
    if (layer.rotation) ctx.rotate(layer.rotation);
    const scale = layer.scale ?? 1;

    if (layer.type === 'text') {
      const family = layer.fontFamily || 'Arial';
      const weight = layer.fontWeight ?? 700;
      // auto-fit: pick the largest size where text fits zone.width
      const targetW = zone.width * 0.92 * scale;
      const targetH = zone.height * 0.92 * scale;
      let size = targetH;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (let i = 0; i < 12; i++) {
        ctx.font = `${weight} ${size}px ${family}`;
        const m = ctx.measureText(layer.content || ' ');
        if (m.width <= targetW) break;
        size *= targetW / Math.max(m.width, 1);
      }
      ctx.font = `${weight} ${size}px ${family}`;
      const drawText = (stroke: boolean) => {
        const curvature = layer.curvature ?? 0;
        if (!curvature) {
          if (stroke) ctx.strokeText(layer.content, 0, 0);
          else ctx.fillText(layer.content, 0, 0);
          return;
        }
        const text = layer.content || '';
        const radius = Math.max(targetW, targetH) * (140 / Math.max(Math.abs(curvature), 1));
        const direction = curvature > 0 ? -1 : 1;
        const totalWidth = ctx.measureText(text).width;
        let cursor = -totalWidth / 2;
        for (const ch of text) {
          const cw = ctx.measureText(ch).width;
          const angle = (cursor + cw / 2) / radius;
          ctx.save();
          ctx.rotate(angle * direction);
          ctx.translate(0, -radius * direction);
          ctx.rotate(-angle * direction);
          if (stroke) ctx.strokeText(ch, 0, radius * direction);
          else ctx.fillText(ch, 0, radius * direction);
          ctx.restore();
          cursor += cw;
        }
      };
      if (layer.strokeWidth && layer.strokeWidth > 0) {
        ctx.lineJoin = 'round';
        ctx.strokeStyle = layer.strokeColor || '#000';
        ctx.lineWidth = layer.strokeWidth;
        drawText(true);
      }
      ctx.fillStyle = layer.color || '#ffffff';
      drawText(false);
    } else {
      try {
        const img = await loadImage(toProxyUrl(layer.url));
        ctx.globalAlpha = layer.opacity ?? 1;
        // contain
        let zw = (zone?.width ?? w) * scale;
        let zh = (zone?.height ?? h) * scale;
        
        // Specialized logic for escudo
        if (isEscudo) {
          const uvWidth = opts.uvWidth || base.naturalWidth;
          const sizePx = scale * uvWidth * 0.06;
          zw = sizePx;
          zh = sizePx;
        } else if (isAppliedStamp) {
          // If it's the main stamp, use full canvas size
          zw = w;
          zh = h;
        }
        
        const ratio = Math.min(zw / img.naturalWidth, zh / img.naturalHeight);
        const dw = img.naturalWidth * ratio;
        const dh = img.naturalHeight * ratio;
        ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh);
      } catch (e) {
        // image failed; ignore
      }
    }
    ctx.restore();
  }

  return canvas;
}