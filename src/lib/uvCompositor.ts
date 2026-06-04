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
  if (!imgCache.has(url)) {
    imgCache.set(url, new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = url;
    }));
  }
  return imgCache.get(url)!;
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
    if (!zone) continue;
    ctx.save();
    // Clip to zone
    ctx.beginPath();
    ctx.rect(zone.x, zone.y, zone.width, zone.height);
    ctx.clip();
    const cx = zone.x + zone.width / 2 + (layer.offsetX ?? 0);
    const cy = zone.y + zone.height / 2 + (layer.offsetY ?? 0);
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
      if (layer.strokeWidth && layer.strokeWidth > 0) {
        ctx.lineJoin = 'round';
        ctx.strokeStyle = layer.strokeColor || '#000';
        ctx.lineWidth = layer.strokeWidth;
        ctx.strokeText(layer.content, 0, 0);
      }
      ctx.fillStyle = layer.color || '#ffffff';
      ctx.fillText(layer.content, 0, 0);
    } else {
      try {
        const img = await loadImage(layer.url);
        ctx.globalAlpha = layer.opacity ?? 1;
        // contain
        const zw = zone.width * scale;
        const zh = zone.height * scale;
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