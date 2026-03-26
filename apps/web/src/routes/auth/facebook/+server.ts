import { redirect } from "@sveltejs/kit";
import { dev } from "$app/environment";
import { facebook } from "$lib/server/auth";
import { generateRandomString, alphabet } from "oslo/crypto";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ cookies }) => {
  const state = generateRandomString(32, alphabet("a-z", "0-9"));

  cookies.set("fb_oauth_state", state, {
    httpOnly: true,
    secure: !dev,
    path: "/",
    maxAge: 60 * 10, // 10 minutes
    sameSite: "lax",
  });

  const url = facebook.createAuthorizationURL(state, ["public_profile"]);
  redirect(302, url.toString());
};
