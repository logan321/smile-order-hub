/**
 * Converts a direct Supabase storage URL to a proxied URL via edge function.
 * This hides the original storage path from browser DevTools.
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

  // Match pattern: .../storage/v1/object/public/<bucket>/<path>
  for (const bucket of BUCKET_NAMES) {
    const marker = `/storage/v1/object/public/${bucket}/`;
    const idx = originalUrl.indexOf(marker);
    if (idx !== -1) {
      const path = originalUrl.substring(idx + marker.length);
      return `${SUPABASE_URL}/functions/v1/serve-image?bucket=${encodeURIComponent(bucket)}&path=${encodeURIComponent(decodeURIComponent(path))}`;
    }
  }

  // Not a recognized storage URL — return as-is
  return originalUrl;
}
