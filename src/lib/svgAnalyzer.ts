
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
  groupName?: string;
  reason?: string;
}

export interface SvgTextElement {
  id: string;
  text: string;
  element: SVGTextElement | SVGTSpanElement;
  fontFamily: string;
  fontSize: string;
}

export interface SvgImageElement {
  id: string;
  href: string;
  element: SVGImageElement;
}

export class SvgAnalyzer {
  private parser: DOMParser;

  constructor() {
    this.parser = new DOMParser();
  }

  /**
   * Parses SVG string and identifies all unique colors, texts and images
   */
  public async analyze(svgString: string): Promise<{
    colors: Map<string, SvgColorGroup>,
    texts: SvgTextElement[],
    images: SvgImageElement[]
  }> {
    const doc = this.parser.parseFromString(svgString, 'image/svg+xml');
    const svg = doc.querySelector('svg');
    
    if (!svg) throw new Error('Invalid SVG');

    const colorMap = new Map<string, SvgColorGroup>();
    const texts: SvgTextElement[] = [];
    const images: SvgImageElement[] = [];
    const allElements = svg.querySelectorAll('*');

    allElements.forEach((el, index) => {
      if (!(el instanceof SVGElement)) return;

      // Analyze colors
      const fill = el.getAttribute('fill');
      const stroke = el.getAttribute('stroke');

      if (fill && fill !== 'none' && fill.startsWith('#')) {
        this.addColorToMap(colorMap, fill.toUpperCase(), el);
      }
      
      if (stroke && stroke !== 'none' && stroke.startsWith('#')) {
        this.addColorToMap(colorMap, stroke.toUpperCase(), el);
      }

      // Analyze texts
      if (el instanceof SVGTextElement || el instanceof SVGTSpanElement) {
        texts.push({
          id: el.id || `text-${index}`,
          text: el.textContent || '',
          element: el,
          fontFamily: el.getAttribute('font-family') || 'Arial',
          fontSize: el.getAttribute('font-size') || '12px'
        });
      }

      // Analyze images (logos)
      if (el instanceof SVGImageElement) {
        images.push({
          id: el.id || `image-${index}`,
          href: el.getAttribute('href') || el.getAttribute('xlink:href') || '',
          element: el
        });
      }
    });

    return { colors: colorMap, texts, images };
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

  /**
   * Updates text content in the SVG
   */
  public updateText(svgDoc: Document, id: string, newText: string): string {
    const el = svgDoc.getElementById(id) || svgDoc.querySelector(`[id="${id}"]`);
    if (el) {
      el.textContent = newText;
    }
    return new XMLSerializer().serializeToString(svgDoc);
  }

  /**
   * Updates image href in the SVG
   */
  public updateImage(svgDoc: Document, id: string, newHref: string): string {
    const el = svgDoc.getElementById(id) || svgDoc.querySelector(`[id="${id}"]`);
    if (el instanceof SVGImageElement) {
      el.setAttribute('href', newHref);
    }
    return new XMLSerializer().serializeToString(svgDoc);
  }
}
