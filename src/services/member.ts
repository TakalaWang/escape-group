import { db } from "../db/client.js";
import { groupMembers, groups } from "../db/schema.js";
import { eq, and, sql } from "drizzle-orm";

type JoinResult =
  | { ok: true }
  | { ok: false; reason: "not_found" | "full" | "already_joined" | "cancelled" };

export async function joinGroup(groupId: string, userId: string): Promise<JoinResult> {
  const group = await db.select().from(groups).where(eq(groups.id, groupId)).limit(1);
  if (group.length === 0) return { ok: false, reason: "not_found" };

  const g = group[0];
  if (g.status === "cancelled") return { ok: false, reason: "cancelled" };

  const existing = await db
    .select()
    .from(groupMembers)
    .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId)))
    .limit(1);
  if (existing.length > 0) return { ok: false, reason: "already_joined" };

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(groupMembers)
    .where(eq(groupMembers.groupId, groupId));
  const currentMembers = g.prefilledMembers + count;
  if (currentMembers >= g.maxMembers) return { ok: false, reason: "full" };

  await db.insert(groupMembers).values({ groupId, userId });

  if (currentMembers + 1 >= g.maxMembers) {
    await db.update(groups).set({ status: "full" }).where(eq(groups.id, groupId));
  }

  return { ok: true };
}
