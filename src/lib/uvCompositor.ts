import type { UvZone } from '@/hooks/useUvLibrary';
import { toProxyUrl } from '@/lib/imageProxy';

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

const imgCache = new Map<string, HTMLImageElement>();
function loadImage(url: string): Promise<HTMLImageElement> {
  if (imgCache.has(url)) {
    const cachedImg = imgCache.get(url)!;
    if (cachedImg.complete && cachedImg.naturalWidth > 0) {
      return Promise.resolve(cachedImg);
    }
  }

  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous'; 
    
    let resolved = false;
    const handleSuccess = () => {
      if (resolved) return;
      if (img.naturalWidth > 0) {
        resolved = true;
        imgCache.set(url, img);
        resolve(img);
      }
    };

    img.onload = handleSuccess;
    img.onerror = (e) => {
      if (resolved) return;
      console.warn('Image load failed:', url, e);
      reject(new Error(`Failed to load image: ${url}`));
    };

    img.src = url;
    
    // Check if already complete (cached)
    if (img.complete && img.naturalWidth > 0) {
      handleSuccess();
    }
    
    // Safety timeout for mobile browsers
    setTimeout(() => {
      if (!resolved && img.complete && img.naturalWidth > 0) {
        handleSuccess();
      }
    }, 100);
  });
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

  // Calcula fator de escala se o canvas for diferente do tamanho natural da imagem base
  const scaleX = w / base.naturalWidth;
  const scaleY = h / base.naturalHeight;

  for (const layer of opts.layers) {
    const rawZone = opts.zones[layer.zoneKey];
    if (!rawZone && !layer.id.includes('applied_stamp')) continue;
    
    // Scale zone coordinates to current canvas resolution
    const zone = rawZone ? {
      x: rawZone.x * scaleX,
      y: rawZone.y * scaleY,
      width: rawZone.width * scaleX,
      height: rawZone.height * scaleY
    } : null;

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
    
    // Scale offsets as well
    const offX = (layer.offsetX ?? 0) * scaleX;
    const offY = (layer.offsetY ?? 0) * scaleY;

    if (isAppliedStamp) {
      cx = w / 2 + offX;
      cy = h / 2 + offY;
    } else if (zone) {
      cx = zone.x + zone.width / 2 + offX;
      cy = zone.y + zone.height / 2 + offY;
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
        // Scale stroke width
        ctx.lineWidth = layer.strokeWidth * scaleX;
        drawText(true);
      }
      ctx.fillStyle = layer.color || '#ffffff';
      drawText(false);
    } else {
      try {
        // Adiciona cache-bust para camadas também no mobile para forçar refresh de CORS
        const isMobile = typeof navigator !== 'undefined' && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
        const proxiedUrl = toProxyUrl(layer.url);
        const layerUrl = isMobile ? `${proxiedUrl}${proxiedUrl.includes('?') ? '&' : '?'}cb=${Date.now()}` : proxiedUrl;
        const img = await loadImage(layerUrl);
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