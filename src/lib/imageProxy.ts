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
];

export function toProxyUrl(originalUrl: string): string {
  if (!originalUrl || !SUPABASE_URL) return originalUrl;

  for (const bucket of BUCKET_NAMES) {
    const marker = `/storage/v1/object/public/${bucket}/`;
    const idx = originalUrl.indexOf(marker);
    if (idx !== -1) {
      const path = decodeURIComponent(originalUrl.substring(idx + marker.length));
      const encoded = btoa(`${bucket}|${path}`);
      return `${SUPABASE_URL}/functions/v1/r?d=${encoded}`;
    }
  }

  return originalUrl;
}
