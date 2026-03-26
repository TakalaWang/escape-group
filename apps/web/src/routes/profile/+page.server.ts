import { redirect } from "@sveltejs/kit";
import { db } from "$lib/server/db";
import { groups, groupMembers, users, escapeRooms } from "@escape-group/db/schema";
import { eq, desc } from "drizzle-orm";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.user) redirect(302, "/auth/facebook");

  // Get user's group history
  const history = await db
    .select({
      memberId: groupMembers.id,
      memberStatus: groupMembers.status,
      joinedAt: groupMembers.joinedAt,
      groupId: groups.id,
      groupMode: groups.mode,
      groupStatus: groups.status,
      groupDatetime: groups.datetime,
      roomName: escapeRooms.name,
      roomStudio: escapeRooms.studio,
    })
    .from(groupMembers)
    .innerJoin(groups, eq(groupMembers.groupId, groups.id))
    .leftJoin(escapeRooms, eq(groups.escapeRoomId, escapeRooms.id))
    .where(eq(groupMembers.userId, locals.user.id))
    .orderBy(desc(groupMembers.joinedAt));

  return {
    history: history.map((h) => ({
      ...h,
      joinedAt: h.joinedAt.toISOString(),
      groupDatetime: h.groupDatetime?.toISOString() ?? null,
    })),
  };
};
