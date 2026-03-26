import { json, error } from "@sveltejs/kit";
import { db } from "$lib/server/db";
import { matchRequests, escapeRooms, users } from "@escape-group/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { sanitizeText, sanitizeUrl } from "$lib/server/validation";
import { tryMatch } from "$lib/server/matching";
import type { RequestHandler } from "./$types";

// GET /api/match — list current user's match requests
export const GET: RequestHandler = async ({ locals }) => {
  if (!locals.user) error(401, "Not authenticated");

  const requests = await db
    .select({
      id: matchRequests.id,
      status: matchRequests.status,
      matchedGroupId: matchRequests.matchedGroupId,
      timeRangeStart: matchRequests.timeRangeStart,
      timeRangeEnd: matchRequests.timeRangeEnd,
      createdAt: matchRequests.createdAt,
      roomName: escapeRooms.name,
      roomStudio: escapeRooms.studio,
      roomLocation: escapeRooms.location,
    })
    .from(matchRequests)
    .innerJoin(escapeRooms, eq(matchRequests.escapeRoomId, escapeRooms.id))
    .where(eq(matchRequests.userId, locals.user.id))
    .orderBy(matchRequests.createdAt);

  return json(
    requests.map((r) => ({
      ...r,
      timeRangeStart: r.timeRangeStart.toISOString(),
      timeRangeEnd: r.timeRangeEnd.toISOString(),
      createdAt: r.createdAt.toISOString(),
    }))
  );
};

// POST /api/match — submit a match request
export const POST: RequestHandler = async ({ request, locals }) => {
  if (!locals.user) error(401, "Not authenticated");
  if (!locals.user.phone) error(403, "Phone verification required");

  const body = await request.json();
  const { roomName, roomStudio, roomUrl, roomLocation, timeRangeStart, timeRangeEnd } = body;

  const cleanName = sanitizeText(roomName, 200);
  if (!cleanName) error(400, "Room name required");
  if (!timeRangeStart || !timeRangeEnd) error(400, "Time range required");

  const start = new Date(timeRangeStart);
  const end = new Date(timeRangeEnd);
  if (end <= start) error(400, "End time must be after start time");

  // Find or create the escape room
  let escapeRoomId: string;
  const [existingRoom] = await db
    .select()
    .from(escapeRooms)
    .where(eq(escapeRooms.name, cleanName))
    .limit(1);

  if (existingRoom) {
    escapeRoomId = existingRoom.id;
  } else {
    const [room] = await db
      .insert(escapeRooms)
      .values({
        name: cleanName,
        studio: sanitizeText(roomStudio, 200),
        url: sanitizeUrl(roomUrl),
        location: sanitizeText(roomLocation, 200),
        createdBy: locals.user.id,
      })
      .returning();
    escapeRoomId = room.id;
  }

  // Create match request
  const [matchRequest] = await db
    .insert(matchRequests)
    .values({
      userId: locals.user.id,
      escapeRoomId,
      timeRangeStart: start,
      timeRangeEnd: end,
    })
    .returning();

  // Try to match immediately
  const matchedGroupId = await tryMatch(escapeRoomId);

  return json(
    {
      ...matchRequest,
      timeRangeStart: matchRequest.timeRangeStart.toISOString(),
      timeRangeEnd: matchRequest.timeRangeEnd.toISOString(),
      createdAt: matchRequest.createdAt.toISOString(),
      matchedGroupId,
    },
    { status: 201 }
  );
};

// DELETE /api/match — cancel a waiting match request
export const DELETE: RequestHandler = async ({ request, locals }) => {
  if (!locals.user) error(401, "Not authenticated");

  const { requestId } = await request.json();
  if (!requestId) error(400, "requestId required");

  const [req] = await db
    .select()
    .from(matchRequests)
    .where(
      and(
        eq(matchRequests.id, requestId),
        eq(matchRequests.userId, locals.user.id),
        eq(matchRequests.status, "waiting")
      )
    );

  if (!req) error(404, "Request not found or already matched");

  await db.delete(matchRequests).where(eq(matchRequests.id, requestId));

  return json({ success: true });
};
