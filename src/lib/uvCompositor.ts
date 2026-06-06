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

export function extractColorsFromSvg(svgText: string): string[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgText, 'image/svg+xml');
  const colors = new Set<string>();

  const extractColor = (el: Element) => {
    let color = el.getAttribute('fill');
    if (!color || color === 'none' || color.startsWith('url')) {
      const style = el.getAttribute('style');
      if (style) {
        const match = style.match(/fill:\s*([^;"]+)/);
        if (match) color = match[1].trim();
      }
    }

    if (color && color.startsWith('#')) {
      // Normalize to 6-digit hex uppercase
      let hex = color.toUpperCase();
      if (hex.length === 4) {
        hex = `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`;
      }
      colors.add(hex.substring(0, 7));
    }
  };

  const elements = doc.querySelectorAll('path, rect, circle, ellipse, polygon, polyline, g');
  elements.forEach(extractColor);

  return Array.from(colors).sort();
}

export function applyColorMapToUv(svgText: string, colorMap: Record<string, string>): string {
  let processedSvg = svgText;

  Object.entries(colorMap).forEach(([originalColor, newColor]) => {
    const hex = originalColor.toUpperCase();
    const shortHex = hex.length === 7 ? `#${hex[1]}${hex[3]}${hex[5]}` : hex;
    
    // Regex to find fill attributes or style fill properties with the original color
    // Handles #FFFFFF, #ffffff, #FFF, etc.
    const escapedHex = hex.replace('#', '');
    const escapedShortHex = shortHex.replace('#', '');
    
    const colorPattern = `(?:#?${escapedHex}|#?${escapedShortHex})`;
    
    // Simple string replacement for specific color values in fill attributes
    // This is a broad stroke approach but safe for SVG text if we target fill="..."
    processedSvg = processedSvg.replace(
      new RegExp(`fill=["']${colorPattern}["']`, 'gi'),
      `fill="${newColor}"`
    );

    processedSvg = processedSvg.replace(
      new RegExp(`fill:\\s*${colorPattern}`, 'gi'),
      `fill:${newColor}`
    );
  });

  return processedSvg;
}

// Keep the old name as alias for backward compatibility
export const applyColorMap = applyColorMapToUv;

export async function scanSvgElements(svgUrl: string): Promise<{
  dynamicIds: string[];
  colors: Record<string, string>;
}> {
  const text = await getSvgText(svgUrl);
  const colors = extractColorsFromSvg(text);
  
  // Backward compatibility: try to map some common IDs if they exist
  const parser = new DOMParser();
  const doc = parser.parseFromString(text, 'image/svg+xml');
  const resultColors: Record<string, string> = {};
  
  colors.forEach((color, index) => {
    resultColors[`color-${index}`] = color;
  });

  return { dynamicIds: [], colors: resultColors };
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
      
      // Use the new applyColorMap logic if shirtColors keys look like hex values
      const isHexMapping = Object.keys(opts.shirtColors).some(k => k.startsWith('#'));
      
      if (isHexMapping) {
        svgText = applyColorMap(svgText, opts.shirtColors);
      } else {
        // Legacy ID-based mapping for backward compatibility
        const idMap: Record<string, string[]> = {
          'corpo-frente':   ['cor-base'],
          'corpo-verso':    ['cor-base-verso'],
          'manga-esquerda': ['manga-esquerda'],
          'manga-direita':  ['manga-direita'],
          'gola':           ['gola', 'gola-2'],
          'gola-interna':   ['gola-interna'],
          'gola-externa':   ['gola-externa'],
          'gola-frente':    ['gola-frente'],
          'gola-verso':     ['gola-verso'],
        };

        Object.entries(opts.shirtColors).forEach(([regionId, color]) => {
          const svgIds = idMap[regionId] || [regionId];
          svgIds.forEach(id => {
            const escapedId = id.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
            const idPattern = `(?:id=["']${escapedId}(?:_[0-9]+)?["'])`;
            
            svgText = svgText.replace(
              new RegExp(`(<[^>]+${idPattern}[^>]*?)fill=["'][^"']*?["']`, 'g'),
              `$1fill="${color}"`
            );

            svgText = svgText.replace(
              new RegExp(`(<[^>]+?)fill=["'][^"']*?["']([^>]*?${idPattern})`, 'g'),
              `fill="${color}"$1$2`
            );

            svgText = svgText.replace(
              new RegExp(`(<[^>]+${idPattern}(?![^>]*fill=)[^>]*)>`, 'g'),
              `$1 fill="${color}">`
            );

            svgText = svgText.replace(
              new RegExp(`(<[^>]+${idPattern}[^>]*?style=["'][^"']*?)fill:\\s*[^;"]*(;?)`, 'g'),
              `$1fill:${color}$2`
            );
          });
        });
      }

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
