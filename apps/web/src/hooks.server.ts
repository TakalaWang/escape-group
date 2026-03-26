import { validateSession } from "$lib/server/auth";
import type { Handle } from "@sveltejs/kit";

export const handle: Handle = async ({ event, resolve }) => {
  const token = event.cookies.get("session");
  if (token) {
    event.locals.user = await validateSession(token);
  } else {
    event.locals.user = null;
  }
  return resolve(event);
};
