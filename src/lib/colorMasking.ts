/**
 * Color masking utility — replaces specific colors in a canvas image with tolerance.
 * Works by comparing each pixel's color distance to the source color and blending
 * toward the target color when within tolerance.
 */

export interface ColorMask {
  sourceColor: [number, number, number]; // RGB
  targetColor: [number, number, number]; // RGB
  tolerance: number; // 0-100
}

/**
 * Parse hex color string to RGB tuple.
 */
export function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  return [
    parseInt(clean.substring(0, 2), 16),
    parseInt(clean.substring(2, 4), 16),
    parseInt(clean.substring(4, 6), 16),
  ];
}

export function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(c => c.toString(16).padStart(2, '0')).join('');
}

/**
 * Calculate Euclidean distance between two RGB colors (0-441.67 range).
 */
function colorDistance(a: [number, number, number], b: [number, number, number]): number {
  return Math.sqrt(
    (a[0] - b[0]) ** 2 +
    (a[1] - b[1]) ** 2 +
    (a[2] - b[2]) ** 2
  );
}

/**
 * Apply color masks to an ImageData object in-place.
 * Preserves luminance/shadow detail by keeping the relative brightness offsets.
 */
export function applyColorMasks(imageData: ImageData, masks: ColorMask[]): void {
  const data = imageData.data;
  const maxDist = 441.67; // sqrt(255^2 * 3)

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];

    // Skip fully transparent pixels
    if (a === 0) continue;

    const pixel: [number, number, number] = [r, g, b];

    for (const mask of masks) {
      const dist = colorDistance(pixel, mask.sourceColor);
      const threshold = (mask.tolerance / 100) * maxDist;

      if (dist <= threshold) {
        // Calculate blend factor — 1 at exact match, 0 at threshold edge
        const blend = 1 - (dist / threshold);

        // Preserve luminance detail: calculate offset from source color
        const offsetR = r - mask.sourceColor[0];
        const offsetG = g - mask.sourceColor[1];
        const offsetB = b - mask.sourceColor[2];

        // Apply target color + offset (preserves shadows/highlights)
        const newR = Math.max(0, Math.min(255, mask.targetColor[0] + offsetR));
        const newG = Math.max(0, Math.min(255, mask.targetColor[1] + offsetG));
        const newB = Math.max(0, Math.min(255, mask.targetColor[2] + offsetB));

        // Blend based on proximity
        data[i] = Math.round(r + (newR - r) * blend);
        data[i + 1] = Math.round(g + (newG - g) * blend);
        data[i + 2] = Math.round(b + (newB - b) * blend);
        break; // Only apply first matching mask
      }
    }
  }
}

/**
 * Get the color of a pixel at (x, y) from a canvas.
 * Returns hex string.
 */
export function getPixelColor(canvas: HTMLCanvasElement, x: number, y: number): string {
  const ctx = canvas.getContext('2d');
  if (!ctx) return '#000000';
  const pixel = ctx.getImageData(x, y, 1, 1).data;
  return rgbToHex(pixel[0], pixel[1], pixel[2]);
}
