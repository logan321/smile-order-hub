import { SiteConfig } from '@/types/siteConfig';
import { DEFAULT_CONFIGS } from '@/contexts/SiteConfigContext';

export const getConfig = (configs: Record<string, string> | undefined, key: string, fallback: string = ''): string => {
  const value = configs?.[key]?.trim();
  if (value) return value;
  return DEFAULT_CONFIGS[key] || fallback;
};

export const getColor = (configs: Record<string, string> | undefined, key: string, fallback: string = '#000000'): string => {
  const value = configs?.[key]?.trim();
  if (!value) return DEFAULT_CONFIGS[key] || fallback;
  
  // Basic hex validation
  if (value.startsWith('#')) return value;
  if (value.startsWith('rgba') || value.startsWith('rgb')) return value;
  return value; // Assume it's a valid CSS color name if not hex
};

export const getIcon = (configs: Record<string, string> | undefined, key: string, fallbackIcon: any): any => {
  const value = configs?.[key]?.trim();
  if (value) {
    // If it's a URL, return it as is (the component will handle rendering an <img>)
    if (value.startsWith('http')) return value;
    // Otherwise it's a lucide icon name or SVG
    return value;
  }
  return fallbackIcon;
};

