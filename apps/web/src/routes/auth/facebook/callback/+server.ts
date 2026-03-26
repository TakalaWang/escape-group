import { redirect, error } from "@sveltejs/kit";
import { dev } from "$app/environment";
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

  let tokens;
  try {
    tokens = await facebook.validateAuthorizationCode(code);
  } catch (e) {
    console.error("Facebook OAuth error:", e);
    error(400, "Facebook 登入失敗，請重試");
  }
  const accessToken = tokens.accessToken();

  // Fetch Facebook user profile
  const fbResponse = await fetch(
    `https://graph.facebook.com/me?fields=id,name,picture.type(large)&access_token=${accessToken}`
  );

  if (!fbResponse.ok) {
    console.error("Facebook API error:", fbResponse.status);
    error(502, "無法取得 Facebook 個人資料");
  }

  const fbUser: { id: string; name: string; picture?: { data?: { url?: string } } } =
    await fbResponse.json();

  if (!fbUser.id || !fbUser.name) {
    error(502, "Facebook 回傳資料格式異常");
  }

  // Upsert user
  const [existingUser] = await db
    .select()
    .from(users)
    .where(eq(users.fbId, fbUser.id));

  let userId: string;
  if (existingUser) {
    userId = existingUser.id;
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
    secure: !dev,
    path: "/",
    maxAge: 30 * 24 * 60 * 60, // 30 days
    sameSite: "lax",
  });

  redirect(302, "/");
};
