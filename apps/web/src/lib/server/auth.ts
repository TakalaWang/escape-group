import { Facebook } from "arctic";
import { sha256 } from "oslo/crypto";
import { encodeHex } from "oslo/encoding";
import { env } from "$env/dynamic/private";
import { db } from "./db.js";
import { sessions, users } from "@escape-group/db/schema";
import { eq } from "drizzle-orm";

export const facebook = new Facebook(
  env.FB_APP_ID!,
  env.FB_APP_SECRET!,
  env.ORIGIN + "/auth/facebook/callback"
);

export async function createSession(userId: string): Promise<string> {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const token = encodeHex(bytes);
  const hash = new Uint8Array(await sha256(new TextEncoder().encode(token)));
  const hashedToken = encodeHex(hash);
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

  await db.insert(sessions).values({
    id: hashedToken,
    userId,
    expiresAt,
  });

  return token;
}

export async function validateSession(token: string) {
  const hash = new Uint8Array(await sha256(new TextEncoder().encode(token)));
  const hashedToken = encodeHex(hash);
  const [session] = await db
    .select()
    .from(sessions)
    .where(eq(sessions.id, hashedToken));
  if (!session || session.expiresAt < new Date()) return null;

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, session.userId));
  return user ?? null;
}

export async function invalidateSession(token: string) {
  const hash = new Uint8Array(await sha256(new TextEncoder().encode(token)));
  const hashedToken = encodeHex(hash);
  await db.delete(sessions).where(eq(sessions.id, hashedToken));
}
