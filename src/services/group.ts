import { db } from "../db/client.js";
import { groups, groupMembers } from "../db/schema.js";
import { eq, sql } from "drizzle-orm";

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
  maxMembers: number;
  prefilledMembers?: number;
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
      maxMembers: input.maxMembers,
      prefilledMembers: input.prefilledMembers ?? 1,
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
