/**
 * Sanitize a URL - only allow http/https protocols
 */
export function sanitizeUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

/**
 * Sanitize text input - trim and limit length
 */
export function sanitizeText(
  text: string | null | undefined,
  maxLength: number = 500
): string | null {
  if (!text) return null;
  const trimmed = text.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, maxLength);
}

/**
 * Validate Taiwan phone number
 */
export function isValidPhone(phone: string): boolean {
  const cleaned = phone.replace(/[\s-]/g, "");
  return /^09\d{8}$/.test(cleaned);
}

/**
 * Clean phone number
 */
export function cleanPhone(phone: string): string {
  return phone.replace(/[\s-]/g, "");
}
