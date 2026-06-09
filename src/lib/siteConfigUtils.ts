import { SiteConfig } from '@/hooks/useSiteConfig';

export const getConfig = (configs: Record<string, string> | undefined, key: string, fallback: string = ''): string => {
  return configs?.[key] ?? fallback;
};

export const getColor = (configs: Record<string, string> | undefined, key: string, fallback: string = '#000000'): string => {
  const value = configs?.[key];
  if (!value) return fallback;
  // Basic hex validation
  if (value.startsWith('#')) return value;
  if (value.startsWith('rgba') || value.startsWith('rgb')) return value;
  return value; // Assume it's a valid CSS color name if not hex
};

export const getIcon = (configs: Record<string, string> | undefined, key: string, fallbackIcon: any): any => {
  const url = configs?.[key];
  if (url && url.trim() !== '') return url;
  return fallbackIcon;
};
