import { error } from "@sveltejs/kit";
import { db } from "$lib/server/db";
import { groups, escapeRooms, users, groupMembers } from "@escape-group/db/schema";
import { eq } from "drizzle-orm";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ params }) => {
  const [group] = await db
    .select({
      id: groups.id,
      mode: groups.mode,
      datetime: groups.datetime,
      timeRangeStart: groups.timeRangeStart,
      timeRangeEnd: groups.timeRangeEnd,
      maxMembers: groups.maxMembers,
      minCredit: groups.minCredit,
      autoAccept: groups.autoAccept,
      status: groups.status,
      createdAt: groups.createdAt,
      hostId: groups.hostId,
      hostName: users.displayName,
      hostCredit: users.creditScore,
      hostAvatar: users.avatarUrl,
      roomName: escapeRooms.name,
      roomStudio: escapeRooms.studio,
      roomLocation: escapeRooms.location,
      roomUrl: escapeRooms.url,
      roomMinPlayers: escapeRooms.minPlayers,
      roomMaxPlayers: escapeRooms.maxPlayers,
    })
    .from(groups)
    .innerJoin(users, eq(groups.hostId, users.id))
    .leftJoin(escapeRooms, eq(groups.escapeRoomId, escapeRooms.id))
    .where(eq(groups.id, params.id));

  if (!group) error(404, "找不到此團");

  const members = await db
    .select({
      id: groupMembers.id,
      userId: groupMembers.userId,
      status: groupMembers.status,
      joinedAt: groupMembers.joinedAt,
      displayName: users.displayName,
      avatarUrl: users.avatarUrl,
      creditScore: users.creditScore,
      isFlagged: users.isFlagged,
    })
    .from(groupMembers)
    .innerJoin(users, eq(groupMembers.userId, users.id))
    .where(eq(groupMembers.groupId, params.id));

  return {
    group: {
      ...group,
      datetime: group.datetime?.toISOString() ?? null,
      timeRangeStart: group.timeRangeStart?.toISOString() ?? null,
      timeRangeEnd: group.timeRangeEnd?.toISOString() ?? null,
      createdAt: group.createdAt.toISOString(),
    },
    members: members.map((m) => ({
      ...m,
      joinedAt: m.joinedAt.toISOString(),
    })),
  };
};
