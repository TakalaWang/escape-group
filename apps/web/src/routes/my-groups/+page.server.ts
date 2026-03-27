import { redirect } from "@sveltejs/kit";
import { db } from "$lib/server/db";
import { groups, groupMembers, users, escapeRooms } from "@escape-group/db/schema";
import { eq, and, desc, sql, inArray } from "drizzle-orm";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.user) redirect(302, "/auth/facebook");

  // Get all groups the user is a member of
  const myMemberships = await db
    .select({ groupId: groupMembers.groupId, memberStatus: groupMembers.status })
    .from(groupMembers)
    .where(eq(groupMembers.userId, locals.user.id));

  if (myMemberships.length === 0) {
    return { activeGroups: [], pastGroups: [] };
  }

  const memberStatusMap = new Map(myMemberships.map((m) => [m.groupId, m.memberStatus]));
  const groupIds = myMemberships.map((m) => m.groupId);

  const result = await db
    .select({
      id: groups.id,
      mode: groups.mode,
      datetime: groups.datetime,
      timeRangeStart: groups.timeRangeStart,
      timeRangeEnd: groups.timeRangeEnd,
      maxMembers: groups.maxMembers,
      minCredit: groups.minCredit,
      status: groups.status,
      createdAt: groups.createdAt,
      hostId: groups.hostId,
      hostName: users.displayName,
      hostCredit: users.creditScore,
      roomName: escapeRooms.name,
      roomStudio: escapeRooms.studio,
      roomLocation: escapeRooms.location,
      roomUrl: escapeRooms.url,
    })
    .from(groups)
    .innerJoin(users, eq(groups.hostId, users.id))
    .leftJoin(escapeRooms, eq(groups.escapeRoomId, escapeRooms.id))
    .where(inArray(groups.id, groupIds))
    .orderBy(desc(groups.createdAt));

  // Get member counts
  const memberCounts = await db
    .select({
      groupId: groupMembers.groupId,
      count: sql<number>`count(*)::int`,
    })
    .from(groupMembers)
    .where(and(inArray(groupMembers.groupId, groupIds), eq(groupMembers.status, "accepted")))
    .groupBy(groupMembers.groupId);

  const countMap = new Map(memberCounts.map((m) => [m.groupId, m.count]));

  const allGroups = result.map((g) => ({
    ...g,
    datetime: g.datetime?.toISOString() ?? null,
    timeRangeStart: g.timeRangeStart?.toISOString() ?? null,
    timeRangeEnd: g.timeRangeEnd?.toISOString() ?? null,
    createdAt: g.createdAt.toISOString(),
    currentMembers: countMap.get(g.id) ?? 0,
    isHost: g.hostId === locals.user!.id,
    memberStatus: memberStatusMap.get(g.id) ?? "pending",
  }));

  return {
    activeGroups: allGroups.filter(
      (g) => g.status === "open" || g.status === "full" || g.status === "confirmed"
    ),
    pastGroups: allGroups.filter((g) => g.status === "completed" || g.status === "cancelled"),
  };
};
