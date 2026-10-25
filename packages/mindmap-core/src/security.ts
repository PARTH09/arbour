const MAX_URL_LENGTH = 2000;
/** Compact data-URL images (local uploads). ~750KB decoded ≈ 1MB encoded. */
export const MAX_IMAGE_DATA_URL = 1_000_000;
const MAP_HREF = /^arbour:map:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;
const DATA_IMAGE = /^data:image\/(png|jpeg|jpg|gif|webp);base64,[a-z0-9+/=\s]+$/i;

/** Allow only http(s) URLs. Imported documents must not carry scripts or credentialed URLs. */
export function sanitizeHttpUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > MAX_URL_LENGTH) return null;

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (url.username || url.password) return null;
  return url.toString();
}

/** Topic images: http(s) links or small local data URLs from file upload. */
export function sanitizeImageUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("data:")) {
    if (trimmed.length > MAX_IMAGE_DATA_URL) return null;
    if (!DATA_IMAGE.test(trimmed)) return null;
    return trimmed.replace(/\s+/g, "");
  }
  return sanitizeHttpUrl(trimmed);
}

/**
 * Topic links may point at http(s) sites or another map on this device via `arbour:map:<uuid>`.
 */
export function sanitizeHref(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > MAX_URL_LENGTH) return null;
  const mapMatch = MAP_HREF.exec(trimmed);
  if (mapMatch) return `arbour:map:${mapMatch[1].toLowerCase()}`;
  return sanitizeHttpUrl(trimmed);
}

export function parseMapHref(value: string | null | undefined): string | null {
  if (!value) return null;
  const match = MAP_HREF.exec(value.trim());
  return match ? match[1].toLowerCase() : null;
}

export function mapHref(documentId: string): string {
  return `arbour:map:${documentId}`;
}

export function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}
