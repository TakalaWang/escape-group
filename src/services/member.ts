import { db } from "../db/client.js";
import { groupMembers, groups, users } from "../db/schema.js";
import { eq, and, sql } from "drizzle-orm";

type JoinResult =
  | { ok: true }
  | { ok: false; reason: "not_found" | "full" | "already_joined" | "cancelled" | "is_host" };

export async function joinGroup(groupId: string, userId: string): Promise<JoinResult> {
  const group = await db.select().from(groups).where(eq(groups.id, groupId)).limit(1);
  if (group.length === 0) return { ok: false, reason: "not_found" };

  const g = group[0];
  if (g.status === "cancelled") return { ok: false, reason: "cancelled" };
  if (g.hostId === userId) return { ok: false, reason: "is_host" };

  // Cross-channel host check: compare displayName since LIFF and Messaging API have different userIds
  const [host] = await db.select().from(users).where(eq(users.id, g.hostId)).limit(1);
  const [joiner] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (host && joiner && host.displayName === joiner.displayName) {
    return { ok: false, reason: "is_host" };
  }

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

type LeaveResult = { ok: true } | { ok: false; reason: "not_found" | "not_member" };

export async function leaveGroup(groupId: string, userId: string): Promise<LeaveResult> {
  const group = await db.select().from(groups).where(eq(groups.id, groupId)).limit(1);
  if (group.length === 0) return { ok: false, reason: "not_found" };

  const existing = await db
    .select()
    .from(groupMembers)
    .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId)))
    .limit(1);
  if (existing.length === 0) return { ok: false, reason: "not_member" };

  await db
    .delete(groupMembers)
    .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId)));

  // Reopen group if it was full
  const g = group[0];
  if (g.status === "full") {
    await db.update(groups).set({ status: "open" }).where(eq(groups.id, groupId));
  }

  return { ok: true };
}
