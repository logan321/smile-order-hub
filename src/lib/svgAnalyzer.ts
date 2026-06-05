
import { hexToCmyk, CMYK } from './cmykEngine';

/**
 * SVG Analyzer - Responsible for reading SVGs and extracting unique colors
 */

export interface SvgColorGroup {
  id?: string; // For explicit layer mapping
  hex: string;
  cmyk: CMYK;
  elements: SVGElement[];
  usageCount: number;
  percentage?: number;
  groupName?: string;
  reason?: string;
  visible?: boolean;
  isFixed?: boolean;
}

export interface SvgTextElement {
  id: string;
  text: string;
  element: SVGTextElement | SVGTSpanElement;
  fontFamily: string;
  fontSize: string;
  groupName?: string;
  visible?: boolean;
}

export interface SvgImageElement {
  id: string;
  href: string;
  element: SVGImageElement;
  groupName?: string;
  visible?: boolean;
  isFixed?: boolean;
}

export interface SvgFeature {
  id: string;
  name: string;
  visible: boolean;
  elements: SVGElement[];
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
    images: SvgImageElement[],
    features: SvgFeature[]
  }> {
    const doc = this.parser.parseFromString(svgString, 'image/svg+xml');
    const svg = doc.querySelector('svg');
    
    if (!svg) throw new Error('Invalid SVG');

    const colorMap = new Map<string, SvgColorGroup>();
    const texts: SvgTextElement[] = [];
    const images: SvgImageElement[] = [];
    const features: SvgFeature[] = [];
    const allElements = svg.querySelectorAll('*');

    allElements.forEach((el, index) => {
      if (!(el instanceof SVGElement)) return;

      // 1. Check for Explicit Layer Mapping (class="svg-camada-cor-X")
      const className = el.getAttribute('class') || '';
      const layerMatch = className.match(/svg-camada-cor-(\d+)/);
      const layerId = layerMatch ? layerMatch[0] : null;

      // Analyze colors
      const fill = el.getAttribute('fill');
      const stroke = el.getAttribute('stroke');

      if (fill && fill !== 'none' && fill.startsWith('#')) {
        this.addColorToMap(colorMap, fill.toUpperCase(), el, layerId);
      }
      
      if (stroke && stroke !== 'none' && stroke.startsWith('#')) {
        this.addColorToMap(colorMap, stroke.toUpperCase(), el, layerId);
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

      // Analyze images (logos / fixed parts)
      if (el instanceof SVGImageElement) {
        const isFixed = className.includes('svg-imagem-fixa') || !layerId;
        images.push({
          id: el.id || `image-${index}`,
          href: el.getAttribute('href') || el.getAttribute('xlink:href') || '',
          element: el,
          isFixed: isFixed,
          groupName: isFixed ? 'Imagem Fixa (Não Editável)' : `Logo ${index + 1}`
        });
      }

      // Detect "Features" - elements with IDs or specific classes
      if (el.id && !el.id.startsWith('text-') && !el.id.startsWith('image-')) {
        features.push({
          id: el.id,
          name: el.id.replace(/[-_]/g, ' '),
          visible: el.getAttribute('display') !== 'none' && el.getAttribute('visibility') !== 'hidden',
          elements: [el]
        });
      }
    });
    
    // Sort colors by usage to help UI prioritize
    const sortedColors = new Map([...colorMap.entries()].sort((a, b) => b[1].usageCount - a[1].usageCount));

    return { colors: sortedColors, texts, images, features };
  }

  private addColorToMap(map: Map<string, SvgColorGroup>, hex: string, element: SVGElement, layerId: string | null = null) {
    const key = layerId || hex;
    
    if (map.has(key)) {
      const group = map.get(key)!;
      group.elements.push(element);
      group.usageCount++;
    } else {
      map.set(key, {
        id: layerId || undefined,
        hex,
        cmyk: hexToCmyk(hex),
        elements: [element],
        usageCount: 1,
        groupName: layerId ? `Camada ${layerId.split('-').pop()} (${hex})` : undefined
      });
    }
  }

  /**
   * Updates all elements of a specific color group in the SVG
   */
  public updateColor(svgDoc: Document, key: string, newHex: string): string {
    // If the key is a layer ID (svg-camada-cor-X), use class selector
    if (key.startsWith('svg-camada-cor')) {
      const elements = svgDoc.querySelectorAll(`.${key}`);
      elements.forEach(el => {
        el.setAttribute('fill', newHex);
        el.setAttribute('stroke', newHex);
      });
    } else {
      // Legacy behavior: update by hex
      const oldHex = key;
      const selector = `[fill="${oldHex}"], [fill="${oldHex.toLowerCase()}"], [fill="${oldHex.toUpperCase()}"], [stroke="${oldHex}"], [stroke="${oldHex.toLowerCase()}"], [stroke="${oldHex.toUpperCase()}"]`;
      const elements = svgDoc.querySelectorAll(selector);
      
      elements.forEach(el => {
        if (el.getAttribute('fill')?.toUpperCase() === oldHex.toUpperCase()) {
          el.setAttribute('fill', newHex);
        }
        if (el.getAttribute('stroke')?.toUpperCase() === oldHex.toUpperCase()) {
          el.setAttribute('stroke', newHex);
        }
      });
    }

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

  /**
   * Toggles visibility of an element or group
   */
  public toggleVisibility(svgDoc: Document, id: string, visible: boolean): string {
    const el = svgDoc.getElementById(id) || svgDoc.querySelector(`[id="${id}"]`);
    if (el) {
      if (visible) {
        el.removeAttribute('display');
        el.removeAttribute('visibility');
      } else {
        el.setAttribute('display', 'none');
      }
    }
    return new XMLSerializer().serializeToString(svgDoc);
  }
}
