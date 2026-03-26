import { validateSession } from "$lib/server/auth";
import { db } from "$lib/server/db";
import { sessions } from "@escape-group/db/schema";
import { lt } from "drizzle-orm";
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
  const token = event.cookies.get("session");
  if (token) {
    event.locals.user = await validateSession(token);
    if (!event.locals.user) {
      // Session invalid/expired — clear cookie
      event.cookies.delete("session", { path: "/" });
    }
  } else {
    event.locals.user = null;
  }

  maybeCleanSessions();

  return resolve(event);
};
