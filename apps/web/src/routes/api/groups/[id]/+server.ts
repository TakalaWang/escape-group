import { json, error } from "@sveltejs/kit";
import { db } from "$lib/server/db";
import { groups, escapeRooms, users, groupMembers } from "@escape-group/db/schema";
import { eq, and } from "drizzle-orm";
import type { RequestHandler } from "./$types";

// GET /api/groups/:id — group detail
export const GET: RequestHandler = async ({ params }) => {
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
      roomId: escapeRooms.id,
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

  if (!group) error(404, "Group not found");

  // Get members
  const members = await db
    .select({
      id: groupMembers.id,
      userId: groupMembers.userId,
      status: groupMembers.status,
      joinedAt: groupMembers.joinedAt,
      displayName: users.displayName,
      avatarUrl: users.avatarUrl,
      creditScore: users.creditScore,
    })
    .from(groupMembers)
    .innerJoin(users, eq(groupMembers.userId, users.id))
    .where(eq(groupMembers.groupId, params.id));

  return json({ ...group, members });
};

// PATCH /api/groups/:id — update group (host only)
export const PATCH: RequestHandler = async ({ params, request, locals }) => {
  if (!locals.user) error(401, "Not authenticated");

  const [group] = await db
    .select()
    .from(groups)
    .where(eq(groups.id, params.id));

  if (!group) error(404, "Group not found");
  if (group.hostId !== locals.user.id) error(403, "Only host can update");

  const body = await request.json();
  const updates: Record<string, unknown> = {};

  if (body.status && ["open", "full", "confirmed", "completed", "cancelled"].includes(body.status)) {
    updates.status = body.status;
  }
  if (body.datetime) updates.datetime = new Date(body.datetime);

  if (Object.keys(updates).length === 0) error(400, "No valid fields to update");

  const [updated] = await db
    .update(groups)
    .set(updates)
    .where(eq(groups.id, params.id))
    .returning();

  return json(updated);
};
