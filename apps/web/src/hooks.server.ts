import { json } from "@sveltejs/kit";
import { validateSession } from "$lib/server/auth";
import { db } from "$lib/server/db";
import { sessions } from "@escape-group/db/schema";
import { lt } from "drizzle-orm";
import { rateLimit, getRateLimitKey } from "$lib/server/ratelimit";
import type { Handle } from "@sveltejs/kit";

// Clean expired sessions every ~100 requests (probabilistic)
let requestCount = 0;
async function maybeCleanSessions() {
  requestCount++;
  if (requestCount % 100 === 0) {
    try {
      await db.delete(sessions).where(lt(sessions.expiresAt, new Date()));
    } catch {
      // Ignore cleanup errors
    }
  }
}

export const handle: Handle = async ({ event, resolve }) => {
  // Auth
  const token = event.cookies.get("session");
  if (token) {
    event.locals.user = await validateSession(token);
    if (!event.locals.user) {
      event.cookies.delete("session", { path: "/" });
    }
  } else {
    event.locals.user = null;
  }

  // Rate limit write requests (POST/PATCH/DELETE on API routes)
  const method = event.request.method;
  const isApiWrite =
    event.url.pathname.startsWith("/api/") &&
    (method === "POST" || method === "PATCH" || method === "DELETE");

  if (isApiWrite) {
    const key = getRateLimitKey(event.locals.user?.id, event.getClientAddress());
    const { allowed, remaining } = rateLimit(key, 30, 60_000);
    if (!allowed) {
      return json(
        { message: "Too many requests. Please try again later." },
        {
          status: 429,
          headers: { "Retry-After": "60" },
        }
      );
    }
  }

  maybeCleanSessions();

  return resolve(event);
};
