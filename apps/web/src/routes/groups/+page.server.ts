import { db } from "$lib/server/db";
import { groups, escapeRooms, users, groupMembers } from "@escape-group/db/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ url }) => {
  const location = url.searchParams.get("location");
  const mode = url.searchParams.get("mode");

  const conditions = [eq(groups.status, "open")];
  if (mode && ["host", "match", "gather"].includes(mode)) {
    conditions.push(eq(groups.mode, mode as "host" | "match" | "gather"));
  }

  const result = await db
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
    .where(and(...conditions))
    .orderBy(desc(groups.createdAt));

  const groupIds = result.map((g) => g.id);
  const memberCounts =
    groupIds.length > 0
      ? await db
          .select({
            groupId: groupMembers.groupId,
            count: sql<number>`count(*)::int`,
          })
          .from(groupMembers)
          .where(
            and(
              sql`${groupMembers.groupId} IN (${sql.join(
                groupIds.map((id) => sql`${id}`),
                sql`, `
              )})`,
              eq(groupMembers.status, "accepted")
            )
          )
          .groupBy(groupMembers.groupId)
      : [];

  const countMap = new Map(memberCounts.map((m) => [m.groupId, m.count]));

  return {
    groups: result.map((g) => ({
      ...g,
      datetime: g.datetime?.toISOString() ?? null,
      timeRangeStart: g.timeRangeStart?.toISOString() ?? null,
      timeRangeEnd: g.timeRangeEnd?.toISOString() ?? null,
      createdAt: g.createdAt.toISOString(),
      currentMembers: countMap.get(g.id) ?? 0,
    })),
    filters: { location, mode },
  };
};
