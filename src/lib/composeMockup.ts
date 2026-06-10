// Helpers to build 2D mockups and UV textures by compositing images on a canvas.
// All composition is done in memory; nothing is uploaded.

const imgCache = new Map<string, Promise<HTMLImageElement>>();

export function loadImage(src: string): Promise<HTMLImageElement> {
  if (!src) return Promise.reject(new Error('empty src'));
  if (imgCache.has(src)) return imgCache.get(src)!;
  const p = new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous'; 
    img.onload = () => {
      if (img.complete && img.naturalWidth > 0) {
        resolve(img);
      } else {
        setTimeout(() => resolve(img), 20);
      }
    };
    img.onerror = (e) => reject(e);
    img.src = src;
    
    if (img.complete && img.naturalWidth > 0) {
      resolve(img);
    }
  });
  imgCache.set(src, p);
  return p;
}

const mockupCache = new Map<string, string>();

/**
 * Build a small mockup (data URL) showing the shirt front with the stamp centered on the chest.
 * Cached by (shirtUrl|stampUrl).
 */
export async function composeShirtMockup(
  shirtFrontUrl: string,
  stampUrl: string,
  size = 320,
): Promise<string> {
  const key = `${size}|${shirtFrontUrl}|${stampUrl}`;
  const cached = mockupCache.get(key);
  if (cached) return cached;

  const [shirt, stamp] = await Promise.all([loadImage(shirtFrontUrl), loadImage(stampUrl)]);

  const canvas = document.createElement('canvas');
  const ratio = shirt.height / shirt.width;
  canvas.width = size;
  canvas.height = Math.round(size * ratio);
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(shirt, 0, 0, canvas.width, canvas.height);

  // Place stamp centered on the upper-chest area (~55% width, vertically around 38%)
  const targetW = canvas.width * 0.55;
  const stampRatio = stamp.height / stamp.width;
  const targetH = targetW * stampRatio;
  const x = (canvas.width - targetW) / 2;
  const y = canvas.height * 0.32;
  ctx.drawImage(stamp, x, y, targetW, targetH);

  const url = canvas.toDataURL('image/png');
  mockupCache.set(key, url);
  return url;
}

/**
 * Compose a UV map (full mold) with a stamp overlay so the 3D model can render
 * the chosen stamp baked into the texture. Returns an HTMLCanvasElement that
 * can be used directly as a THREE.CanvasTexture source.
 */
export async function composeUvWithStamp(
  uvMapUrl: string,
  stampUrl: string | null,
  region = { xPct: 0.5, yPct: 0.32, widthPct: 0.28 },
): Promise<HTMLCanvasElement> {
  const uv = await loadImage(uvMapUrl);
  const canvas = document.createElement('canvas');
  canvas.width = uv.naturalWidth;
  canvas.height = uv.naturalHeight;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(uv, 0, 0);

  if (stampUrl) {
    try {
      const stamp = await loadImage(stampUrl);
      const targetW = canvas.width * region.widthPct;
      const stampRatio = stamp.height / stamp.width;
      const targetH = targetW * stampRatio;
      const cx = canvas.width * region.xPct;
      const cy = canvas.height * region.yPct;
      ctx.drawImage(stamp, cx - targetW / 2, cy - targetH / 2, targetW, targetH);
    } catch (e) {
      console.warn('Failed to load stamp for UV compose', e);
    }
  }

  return canvas;
}