/**
 * Converts a direct Supabase storage URL to an obfuscated proxy URL.
 * Parameters are base64-encoded so the original bucket/path is not visible in DevTools.
 */
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

const BUCKET_NAMES = [
  'stamp-catalog',
  'patch-catalog',
  'shirt-templates',
  'text-styles',
  'shirt-designs',
  'uv-maps',
];

export function toProxyUrl(originalUrl: string): string {
  if (!originalUrl || !SUPABASE_URL) return originalUrl;

  for (const bucket of BUCKET_NAMES) {
    const marker = `/storage/v1/object/public/${bucket}/`;
    const idx = originalUrl.indexOf(marker);
    if (idx !== -1) {
      const path = decodeURIComponent(originalUrl.substring(idx + marker.length));
      // Usa uma codificação segura para UTF-8 que funciona em btoa
      const encoded = btoa(encodeURIComponent(`${bucket}|${path}`).replace(/%([0-9A-F]{2})/g, (match, p1) => 
        String.fromCharCode(parseInt(p1, 16))
      ));
      return `${SUPABASE_URL}/functions/v1/r?d=${encoded}`;
    }
  }

  return originalUrl;
}
