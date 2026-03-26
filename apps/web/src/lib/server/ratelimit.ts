/**
 * Simple in-memory rate limiter for MVP.
 * Tracks request counts per key (IP or user ID) in sliding windows.
 */

const store = new Map<string, { count: number; resetAt: number }>();

// Clean up expired entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (entry.resetAt < now) store.delete(key);
  }
}, 60_000);

export function rateLimit(
  key: string,
  limit: number = 30,
  windowMs: number = 60_000
): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || entry.resetAt < now) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1 };
  }

  entry.count++;
  if (entry.count > limit) {
    return { allowed: false, remaining: 0 };
  }

  return { allowed: true, remaining: limit - entry.count };
}

/**
 * Get rate limit key from request — uses user ID if logged in, IP otherwise.
 */
export function getRateLimitKey(
  userId: string | null | undefined,
  ip: string | undefined
): string {
  return userId ?? ip ?? "anonymous";
}
