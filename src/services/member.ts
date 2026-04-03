import { db } from "../db/client.js";
import { groupMembers, groups } from "../db/schema.js";
import { eq, and, sql } from "drizzle-orm";

type JoinResult =
  | { ok: true; groupFull: boolean; groupId: string }
  | { ok: false; reason: "not_found" | "full" | "already_joined" | "cancelled" | "is_host" };

export async function joinGroup(groupId: string, userId: string): Promise<JoinResult> {
  return await db.transaction(async (tx) => {
    const group = await tx.select().from(groups).where(eq(groups.id, groupId)).limit(1);
    if (group.length === 0) return { ok: false, reason: "not_found" } as const;

    const g = group[0];
    if (g.status === "cancelled") return { ok: false, reason: "cancelled" } as const;
    if (g.hostId === userId) return { ok: false, reason: "is_host" } as const;

    const existing = await tx
      .select()
      .from(groupMembers)
      .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId)))
      .limit(1);
    if (existing.length > 0) return { ok: false, reason: "already_joined" } as const;

    const [{ count }] = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(groupMembers)
      .where(eq(groupMembers.groupId, groupId));
    const currentMembers = g.prefilledMembers + count;
    if (currentMembers >= g.maxMembers) return { ok: false, reason: "full" } as const;

    await tx.insert(groupMembers).values({ groupId, userId });

    const isFull = currentMembers + 1 >= g.maxMembers;
    if (isFull) {
      await tx.update(groups).set({ status: "full" }).where(eq(groups.id, groupId));
    }

    return { ok: true, groupFull: isFull, groupId } as const;
  });
}

type LeaveResult = { ok: true } | { ok: false; reason: "not_found" | "not_member" };

export async function leaveGroup(groupId: string, userId: string): Promise<LeaveResult> {
  return await db.transaction(async (tx) => {
    const group = await tx.select().from(groups).where(eq(groups.id, groupId)).limit(1);
    if (group.length === 0) return { ok: false, reason: "not_found" } as const;

    const existing = await tx
      .select()
      .from(groupMembers)
      .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId)))
      .limit(1);
    if (existing.length === 0) return { ok: false, reason: "not_member" } as const;

    await tx
      .delete(groupMembers)
      .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId)));

    // Reopen group if it was full
    const g = group[0];
    if (g.status === "full") {
      await tx.update(groups).set({ status: "open" }).where(eq(groups.id, groupId));
    }

    return { ok: true } as const;
  });
}

export async function kickMember(
  groupId: string,
  memberId: string,
  hostId: string
): Promise<{ ok: boolean; reason?: string }> {
  return await db.transaction(async (tx) => {
    const group = await tx.select().from(groups).where(eq(groups.id, groupId)).limit(1);
    if (group.length === 0) return { ok: false, reason: "not_found" };
    if (group[0].hostId !== hostId) return { ok: false, reason: "not_host" };

    const existing = await tx
      .select()
      .from(groupMembers)
      .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, memberId)))
      .limit(1);
    if (existing.length === 0) return { ok: false, reason: "not_member" };

    await tx
      .delete(groupMembers)
      .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, memberId)));

    if (group[0].status === "full") {
      await tx.update(groups).set({ status: "open" }).where(eq(groups.id, groupId));
    }

    return { ok: true };
  });
}
