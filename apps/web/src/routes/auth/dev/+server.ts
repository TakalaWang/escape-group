import { redirect, error } from "@sveltejs/kit";
import { dev } from "$app/environment";
import { db } from "$lib/server/db";
import { users } from "@escape-group/db/schema";
import { eq } from "drizzle-orm";
import { createSession } from "$lib/server/auth";
import type { RequestHandler } from "./$types";

// Dev-only login: GET /auth/dev?user=1 (uses first demo user)
// Only available in development mode
export const GET: RequestHandler = async ({ url, cookies }) => {
  if (!dev) error(404, "Not found");

  const fbId = url.searchParams.get("user") ?? "demo_user_1";

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.fbId, fbId));

  if (!user) error(404, "Demo user not found. Run `pnpm db:seed` first.");

  const token = await createSession(user.id);

  cookies.set("session", token, {
    httpOnly: true,
    secure: false,
    path: "/",
    maxAge: 30 * 24 * 60 * 60,
    sameSite: "lax",
  });

  redirect(302, "/");
};
