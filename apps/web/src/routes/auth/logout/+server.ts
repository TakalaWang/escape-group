import { redirect } from "@sveltejs/kit";
import { invalidateSession } from "$lib/server/auth";
import type { RequestHandler } from "./$types";

export const POST: RequestHandler = async ({ cookies }) => {
  const token = cookies.get("session");
  if (token) {
    await invalidateSession(token);
    cookies.delete("session", { path: "/" });
  }
  redirect(302, "/");
};
