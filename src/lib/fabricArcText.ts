import { Path, FabricText, Textbox } from 'fabric';

/**
 * Build an SVG quadratic-bezier arc path going from (0,0) to (width,0).
 * @param width  baseline width of the text (px)
 * @param curvature  -100..100. 0 = flat. Positive = smile (arc up). Negative = frown (arc down).
 */
export function buildArcPath(width: number, curvature: number): Path | null {
  if (!width || Math.abs(curvature) < 1) return null;
  // sagitta proportional to text width — up to ~60% of width at full curvature
  const sagitta = (curvature / 100) * width * 0.6;
  // Negative Y in SVG = up. Positive curvature should arc text upward.
  const controlY = -sagitta;
  const controlX = width / 2;
  const d = `M 0 0 Q ${controlX} ${controlY} ${width} 0`;
  const p = new Path(d, {
    fill: '',
    stroke: '',
    objectCaching: false,
    visible: false,
  });
  return p;
}

/**
 * Apply / remove an arc on a FabricText (single-line only — Textbox not supported).
 * Re-computes the path from the current text width so it always fits.
 */
export function applyArcToText(text: FabricText | Textbox, curvature: number) {
  if (text instanceof Textbox) return; // multiline not supported
  const anyText = text as any;
  if (!curvature || Math.abs(curvature) < 1) {
    if (anyText.path) {
      anyText.set({ path: null });
      anyText._curvature = 0;
    }
    return;
  }
  // Width estimate: prefer measureText result if available, else fall back to text.width.
  const w = Math.max(40, text.width || 200);
  const path = buildArcPath(w, curvature);
  if (path) {
    anyText.set({ path });
    anyText._curvature = curvature;
  }
}