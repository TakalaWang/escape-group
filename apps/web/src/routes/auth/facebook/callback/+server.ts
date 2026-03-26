import { redirect, error } from "@sveltejs/kit";
import { facebook, createSession } from "$lib/server/auth";
import { db } from "$lib/server/db";
import { users } from "@escape-group/db/schema";
import { eq } from "drizzle-orm";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ url, cookies }) => {
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const storedState = cookies.get("fb_oauth_state");

  if (!code || !state || state !== storedState) {
    error(400, "Invalid OAuth state");
  }

  cookies.delete("fb_oauth_state", { path: "/" });

  const tokens = await facebook.validateAuthorizationCode(code);
  const accessToken = tokens.accessToken();

  // Fetch Facebook user profile
  const fbResponse = await fetch(
    `https://graph.facebook.com/me?fields=id,name,picture.type(large)&access_token=${accessToken}`
  );
  const fbUser: { id: string; name: string; picture?: { data?: { url?: string } } } =
    await fbResponse.json();

  // Upsert user
  const [existingUser] = await db
    .select()
    .from(users)
    .where(eq(users.fbId, fbUser.id));

  let userId: string;
  if (existingUser) {
    userId = existingUser.id;
    // Update display name and avatar
    await db
      .update(users)
      .set({
        displayName: fbUser.name,
        avatarUrl: fbUser.picture?.data?.url ?? null,
      })
      .where(eq(users.id, existingUser.id));
  } else {
    const [newUser] = await db
      .insert(users)
      .values({
        fbId: fbUser.id,
        displayName: fbUser.name,
        avatarUrl: fbUser.picture?.data?.url ?? null,
      })
      .returning({ id: users.id });
    userId = newUser.id;
  }

  const sessionToken = await createSession(userId);

  cookies.set("session", sessionToken, {
    httpOnly: true,
    secure: false, // TODO: set true in production
    path: "/",
    maxAge: 30 * 24 * 60 * 60, // 30 days
    sameSite: "lax",
  });

  redirect(302, "/");
};
