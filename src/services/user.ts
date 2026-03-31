import { db } from "../db/client.js";
import { users } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { getLineClient } from "../line/client.js";

export async function upsertUser(lineUserId: string) {
  const existing = await db.select().from(users).where(eq(users.lineUserId, lineUserId)).limit(1);
  if (existing.length > 0) return existing[0];

  const client = getLineClient();
  const profile = await client.getProfile(lineUserId);

  const [user] = await db
    .insert(users)
    .values({
      lineUserId,
      displayName: profile.displayName,
      pictureUrl: profile.pictureUrl ?? null,
    })
    .returning();

  return user;
}

export async function upsertUserFromLiff(lineUserId: string, displayName: string) {
  const existing = await db.select().from(users).where(eq(users.lineUserId, lineUserId)).limit(1);
  if (existing.length > 0) return existing[0];

  const [user] = await db.insert(users).values({ lineUserId, displayName }).returning();

  return user;
}

export async function getUserByLineId(lineUserId: string) {
  const result = await db.select().from(users).where(eq(users.lineUserId, lineUserId)).limit(1);
  return result[0] ?? null;
}
