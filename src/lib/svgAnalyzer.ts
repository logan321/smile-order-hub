
import { hexToCmyk, CMYK } from './cmykEngine';

/**
 * SVG Analyzer - Responsible for reading SVGs and extracting unique colors
 */

export interface SvgColorGroup {
  hex: string;
  cmyk: CMYK;
  elements: SVGElement[];
  usageCount: number;
  percentage?: number;
}

export class SvgAnalyzer {
  private parser: DOMParser;

  constructor() {
    this.parser = new DOMParser();
  }

  /**
   * Parses SVG string and identifies all unique colors
   */
  public async analyze(svgString: string): Promise<Map<string, SvgColorGroup>> {
    const doc = this.parser.parseFromString(svgString, 'image/svg+xml');
    const svg = doc.querySelector('svg');
    
    if (!svg) throw new Error('Invalid SVG');

    const colorMap = new Map<string, SvgColorGroup>();
    const allElements = svg.querySelectorAll('*');

    allElements.forEach((el) => {
      if (!(el instanceof SVGElement)) return;

      const fill = el.getAttribute('fill');
      const stroke = el.getAttribute('stroke');

      if (fill && fill !== 'none' && fill.startsWith('#')) {
        this.addColorToMap(colorMap, fill.toUpperCase(), el);
      }
      
      if (stroke && stroke !== 'none' && stroke.startsWith('#')) {
        this.addColorToMap(colorMap, stroke.toUpperCase(), el);
      }
    });

    return colorMap;
  }

  private addColorToMap(map: Map<string, SvgColorGroup>, hex: string, element: SVGElement) {
    if (map.has(hex)) {
      const group = map.get(hex)!;
      group.elements.push(element);
      group.usageCount++;
    } else {
      map.set(hex, {
        hex,
        cmyk: hexToCmyk(hex),
        elements: [element],
        usageCount: 1
      });
    }
  }

  /**
   * Updates all elements of a specific color group in the SVG
   */
  public updateColor(svgDoc: Document, oldHex: string, newHex: string): string {
    const elements = svgDoc.querySelectorAll(`[fill="${oldHex}"], [fill="${oldHex.toLowerCase()}"]`);
    elements.forEach(el => el.setAttribute('fill', newHex));
    
    const strokeElements = svgDoc.querySelectorAll(`[stroke="${oldHex}"], [stroke="${oldHex.toLowerCase()}"]`);
    strokeElements.forEach(el => el.setAttribute('stroke', newHex));

    return new XMLSerializer().serializeToString(svgDoc);
  }
}
