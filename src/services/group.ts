import { db } from "../db/client.js";
import { groups, groupMembers, users } from "../db/schema.js";
import { eq, and, sql, ne } from "drizzle-orm";

type CreateGroupInput = {
  roomName: string;
  studio?: string;
  location?:
    | "taipei"
    | "new_taipei"
    | "taoyuan"
    | "hsinchu"
    | "taichung"
    | "tainan"
    | "kaohsiung"
    | "yilan"
    | "hualien";
  datetime?: string;
  duration?: number;
  minMembers?: number;
  maxMembers: number;
  prefilledMembers?: number;
  price?: number;
  note?: string;
};

type ValidationResult = { ok: true } | { ok: false; error: string };

export function validateCreateGroupInput(input: Partial<CreateGroupInput>): ValidationResult {
  if (!input.roomName || input.roomName.trim().length === 0) {
    return { ok: false, error: "密室名稱為必填" };
  }
  if (!input.maxMembers || input.maxMembers < 2) {
    return { ok: false, error: "人數上限至少為 2" };
  }
  const prefilled = input.prefilledMembers ?? 1;
  if (prefilled >= input.maxMembers) {
    return { ok: false, error: "已有人數必須小於人數上限" };
  }
  return { ok: true };
}

export async function createGroup(hostId: string, input: CreateGroupInput) {
  const [group] = await db
    .insert(groups)
    .values({
      hostId,
      roomName: input.roomName.trim(),
      studio: input.studio?.trim() || null,
      location: input.location ?? null,
      datetime: input.datetime ? new Date(input.datetime) : null,
      duration: input.duration ?? null,
      minMembers: input.minMembers ?? null,
      maxMembers: input.maxMembers,
      prefilledMembers: input.prefilledMembers ?? 1,
      price: input.price ?? null,
      note: input.note?.trim() || null,
    })
    .returning();

  return group;
}

export async function getGroupById(groupId: string) {
  const result = await db.select().from(groups).where(eq(groups.id, groupId)).limit(1);
  return result[0] ?? null;
}

export async function getGroupMemberCount(groupId: string): Promise<number> {
  const result = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(groupMembers)
    .where(eq(groupMembers.groupId, groupId));
  return result[0]?.count ?? 0;
}

export async function getGroupsByHost(hostId: string) {
  const results = await db
    .select({
      id: groups.id,
      roomName: groups.roomName,
      datetime: groups.datetime,
      maxMembers: groups.maxMembers,
      prefilledMembers: groups.prefilledMembers,
      status: groups.status,
      memberCount: sql<number>`(
        SELECT count(*)::int FROM group_members
        WHERE group_members.group_id = groups.id
      )`,
    })
    .from(groups)
    .where(and(eq(groups.hostId, hostId), ne(groups.status, "cancelled")))
    .orderBy(groups.createdAt);

  return results.map((r) => ({
    ...r,
    currentMembers: r.prefilledMembers + (r.memberCount ?? 0),
  }));
}

export async function updateGroup(groupId: string, updates: Record<string, any>) {
  const [updated] = await db
    .update(groups)
    .set(updates)
    .where(eq(groups.id, groupId))
    .returning();
  return updated;
}

export async function cancelGroup(groupId: string, hostId: string): Promise<boolean> {
  await db
    .update(groups)
    .set({ status: "cancelled" })
    .where(and(eq(groups.id, groupId), eq(groups.hostId, hostId)));
  return true;
}

export async function getJoinedGroups(userId: string) {
  const results = await db
    .select({
      id: groups.id,
      roomName: groups.roomName,
      datetime: groups.datetime,
      maxMembers: groups.maxMembers,
      prefilledMembers: groups.prefilledMembers,
      status: groups.status,
      hostName: users.displayName,
      memberCount: sql<number>`(
        SELECT count(*)::int FROM group_members
        WHERE group_members.group_id = groups.id
      )`,
    })
    .from(groupMembers)
    .innerJoin(groups, eq(groupMembers.groupId, groups.id))
    .innerJoin(users, eq(groups.hostId, users.id))
    .where(and(eq(groupMembers.userId, userId), ne(groups.status, "cancelled")))
    .orderBy(groups.datetime);

  return results.map((r) => ({
    ...r,
    currentMembers: r.prefilledMembers + (r.memberCount ?? 0),
    hostName: r.hostName ?? "Unknown",
  }));
}

export async function getGroupMembers(groupId: string) {
  return db
    .select({
      id: users.id,
      displayName: users.displayName,
      lineUserId: users.lineUserId,
    })
    .from(groupMembers)
    .innerJoin(users, eq(groupMembers.userId, users.id))
    .where(eq(groupMembers.groupId, groupId));
}
