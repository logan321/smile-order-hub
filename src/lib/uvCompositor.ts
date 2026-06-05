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

const svgCache: Record<string, string> = {};

async function getSvgText(url: string): Promise<string> {
  if (svgCache[url]) return svgCache[url];
  const res = await fetch(url);
  const text = await res.text();
  svgCache[url] = text;
  return text;
}

export async function scanSvgElements(svgUrl: string): Promise<{
  dynamicIds: string[];
  colors: Record<string, string>;
}> {
  const text = await getSvgText(svgUrl);
  const parser = new DOMParser();
  const doc = parser.parseFromString(text, 'image/svg+xml');
  
  const colors: Record<string, string> = {};
  const fixedIds = ['cor-base', 'cor-base-verso', 'manga-esquerda', 'manga-direita', 'gola', 'gola_5'];
  
  const extractFill = (el: Element) => {
    let color = el.getAttribute('fill');
    if (!color || color === 'none') {
      const style = el.getAttribute('style');
      if (style) {
        const match = style.match(/fill:\s*([^;"]+)/);
        if (match) color = match[1].trim();
      }
    }
    if (color && color.startsWith('#')) {
      if (color.length === 4) {
        return '#' + color[1] + color[1] + color[2] + color[2] + color[3] + color[3];
      }
      return color.substring(0, 7).toUpperCase();
    }
    return null;
  };

  fixedIds.forEach(id => {
    const el = doc.getElementById(id);
    if (el) {
      const color = extractFill(el);
      if (color) colors[id] = color;
    }
  });

  // Helper to normalize Corel IDs (remove suffixes like _1, _2)
  const normalizeId = (id: string) => id.split('_')[0];

  const allElementsWithId = Array.from(doc.querySelectorAll('[id]')).filter(el => 
    el.id.startsWith('elemento') && !fixedIds.includes(el.id)
  );

  const dynamicIdsMap = new Map<string, string>(); // rootId -> originalId (for color extraction)
  
  allElementsWithId.forEach(el => {
    const rootId = normalizeId(el.id);
    if (!colors[rootId]) {
      const color = extractFill(el);
      if (color) colors[rootId] = color;
    }
    dynamicIdsMap.set(rootId, rootId);
  });

  const dynamicIds = Array.from(dynamicIdsMap.keys()).sort((a, b) => {
    const numA = parseInt(a.replace('elemento-', '').replace('elemento', '1')) || 1;
    const numB = parseInt(b.replace('elemento-', '').replace('elemento', '1')) || 1;
    return numA - numB;
  });
  
  return { dynamicIds, colors };
}

let persistentCanvas: HTMLCanvasElement | null = null;

export async function composeUvTexture(opts: {
  baseUrl: string;
  uvWidth?: number | null;
  uvHeight?: number | null;
  zones: Record<string, UvZone>;
  layers: UvLayer[];
  canvas?: HTMLCanvasElement;
  shirtColors?: Record<string, string>;
}): Promise<HTMLCanvasElement> {
  let finalBaseUrl = opts.baseUrl;

  if (opts.shirtColors && Object.keys(opts.shirtColors).length > 0) {
    try {
      let svgText = await getSvgText(opts.baseUrl);
      svgText = svgText.slice(); // Ensure we don't mutate cache

      const idMap: Record<string, string[]> = {
        'corpo-frente': ['cor-base'],
        'corpo-verso': ['cor-base-verso'],
        'manga-esquerda': ['manga-esquerda'],
        'manga-direita': ['manga-direita'],
        'gola': ['gola', 'gola_5'],
      };

      Object.entries(opts.shirtColors).forEach(([regionId, color]) => {
        const svgIds = idMap[regionId] || [regionId];
        svgIds.forEach(id => {
          // Strict ID pattern: Matches exact ID OR ID with Corel suffix (_1, _2, etc.)
          // Uses word boundary \b or similar logic via negative lookahead to avoid partial matches like 'elemento' matching 'elemento-1'
          // Corel suffixes are usually _ followed by numbers.
          const idPattern = `${id}(?:_[0-9]+)?`;
          
          // Replace for id="..." fill="..."
          // Using a more robust regex that ensures the id is exactly what we want (with optional suffix)
          const attrIdRegex = new RegExp(`(id="${idPattern}"[^>]*?)fill="[^"]*"`, 'g');
          svgText = svgText.replace(attrIdRegex, `$1fill="${color}"`);
          
          // Replace for style="fill:..."
          const styleIdRegex = new RegExp(`(id="${idPattern}"[^>]*?style="[^"]*?)fill:[^;"]*(;?)`, 'g');
          svgText = svgText.replace(styleIdRegex, `$1fill:${color}$2`);
          
          // Reverse order: fill="..." id="..."
          const fillFirstRegex = new RegExp(`fill="[^"]*"([^>]*?id="${idPattern}")`, 'g');
          svgText = svgText.replace(fillFirstRegex, `fill="${color}"$1`);
        });
      });

      const blob = new Blob([svgText], { type: 'image/svg+xml' });
      finalBaseUrl = URL.createObjectURL(blob);
    } catch (err) {
      console.warn('Failed to process SVG colors, falling back to original', err);
    }
  }


  const base = await loadImage(finalBaseUrl);
  const w = opts.uvWidth || base.naturalWidth;
  const h = opts.uvHeight || base.naturalHeight;
  if (!persistentCanvas && !opts.canvas) {
    persistentCanvas = document.createElement('canvas');
  }
  const canvas = opts.canvas ?? persistentCanvas!;
  if (canvas.width !== w) canvas.width = w;
  if (canvas.height !== h) canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, w, h);
  ctx.drawImage(base, 0, 0, w, h);

  if (finalBaseUrl !== opts.baseUrl) {
    URL.revokeObjectURL(finalBaseUrl);
  }


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
      let size = Math.max(8, layer.fontSize ?? targetH);
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