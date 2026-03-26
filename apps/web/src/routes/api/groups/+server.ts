import { json, error } from "@sveltejs/kit";
import { db } from "$lib/server/db";
import { groups, escapeRooms, users, groupMembers } from "@escape-group/db/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import type { RequestHandler } from "./$types";

// GET /api/groups — list open groups
export const GET: RequestHandler = async ({ url }) => {
  const location = url.searchParams.get("location");
  const mode = url.searchParams.get("mode");

  const conditions = [eq(groups.status, "open")];
  if (location) {
    // Safe: Drizzle's sql`` uses parameterized queries
    conditions.push(eq(escapeRooms.location, location));
  }
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

  // Get member counts
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

  return json(
    result.map((g) => ({
      ...g,
      currentMembers: countMap.get(g.id) ?? 0,
    }))
  );
};

// POST /api/groups — create a new group
export const POST: RequestHandler = async ({ request, locals }) => {
  if (!locals.user) error(401, "Not authenticated");
  if (!locals.user.phone) error(403, "Phone verification required");

  const body = await request.json();
  const { mode, escapeRoom, datetime, timeRangeStart, timeRangeEnd, maxMembers, minCredit, autoAccept } = body;

  if (!mode || !["host", "match", "gather"].includes(mode)) {
    error(400, "Invalid mode");
  }
  if (!maxMembers || maxMembers < 2) {
    error(400, "Max members must be at least 2");
  }

  // Create escape room entry if provided
  let escapeRoomId: string | null = null;
  if (escapeRoom?.name) {
    const [room] = await db
      .insert(escapeRooms)
      .values({
        name: escapeRoom.name,
        studio: escapeRoom.studio ?? null,
        url: escapeRoom.url ?? null,
        location: escapeRoom.location ?? null,
        minPlayers: escapeRoom.minPlayers ?? null,
        maxPlayers: escapeRoom.maxPlayers ?? null,
        createdBy: locals.user.id,
      })
      .returning({ id: escapeRooms.id });
    escapeRoomId = room.id;
  }

  const [group] = await db
    .insert(groups)
    .values({
      mode,
      escapeRoomId,
      hostId: locals.user.id,
      datetime: datetime ? new Date(datetime) : null,
      timeRangeStart: timeRangeStart ? new Date(timeRangeStart) : null,
      timeRangeEnd: timeRangeEnd ? new Date(timeRangeEnd) : null,
      maxMembers,
      minCredit: minCredit ?? 0,
      autoAccept: autoAccept ?? true,
    })
    .returning();

  // Auto-add host as accepted member
  await db.insert(groupMembers).values({
    groupId: group.id,
    userId: locals.user.id,
    status: "accepted",
  });

  return json(group, { status: 201 });
};
