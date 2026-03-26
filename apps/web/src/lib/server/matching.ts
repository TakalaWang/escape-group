import { db } from "./db.js";
import {
  matchRequests,
  groups,
  groupMembers,
  escapeRooms,
} from "@escape-group/db/schema";
import { eq, and, sql, lte, gte } from "drizzle-orm";

const MIN_MATCH_SIZE = 4; // Minimum players to form a match

/**
 * Try to match waiting requests for the same escape room with overlapping time ranges.
 * When enough people overlap, auto-create a group.
 */
export async function tryMatch(escapeRoomId: string): Promise<string | null> {
  // Get all waiting requests for this room
  const waiting = await db
    .select()
    .from(matchRequests)
    .where(
      and(
        eq(matchRequests.escapeRoomId, escapeRoomId),
        eq(matchRequests.status, "waiting")
      )
    )
    .orderBy(matchRequests.createdAt);

  if (waiting.length < MIN_MATCH_SIZE) return null;

  // Get room info for max players
  const [room] = await db
    .select()
    .from(escapeRooms)
    .where(eq(escapeRooms.id, escapeRoomId));

  const maxSize = room?.maxPlayers ?? 8;

  // Find the largest overlapping time window
  // Simple greedy: for each pair of requests, find overlap, then count how many others fit
  let bestGroup: typeof waiting = [];

  for (let i = 0; i < waiting.length; i++) {
    const anchor = waiting[i];
    const compatible = waiting.filter((r) => {
      // Check time overlap
      return (
        r.timeRangeStart <= anchor.timeRangeEnd &&
        r.timeRangeEnd >= anchor.timeRangeStart
      );
    });

    if (compatible.length >= MIN_MATCH_SIZE && compatible.length > bestGroup.length) {
      bestGroup = compatible.slice(0, maxSize); // Cap at max players
    }
  }

  if (bestGroup.length < MIN_MATCH_SIZE) return null;

  // Find the common time window
  const commonStart = new Date(
    Math.max(...bestGroup.map((r) => r.timeRangeStart.getTime()))
  );
  const commonEnd = new Date(
    Math.min(...bestGroup.map((r) => r.timeRangeEnd.getTime()))
  );

  // Pick the midpoint as the event time
  const eventTime = new Date((commonStart.getTime() + commonEnd.getTime()) / 2);

  // Create the group (first requester becomes host)
  const hostId = bestGroup[0].userId;
  const [group] = await db
    .insert(groups)
    .values({
      mode: "match",
      escapeRoomId,
      hostId,
      datetime: eventTime,
      timeRangeStart: commonStart,
      timeRangeEnd: commonEnd,
      maxMembers: bestGroup.length,
      autoAccept: true,
      status: bestGroup.length >= maxSize ? "full" : "open",
    })
    .returning();

  // Add all matched users as members
  await db.insert(groupMembers).values(
    bestGroup.map((r) => ({
      groupId: group.id,
      userId: r.userId,
      status: "accepted" as const,
    }))
  );

  // Mark requests as matched
  for (const r of bestGroup) {
    await db
      .update(matchRequests)
      .set({ status: "matched", matchedGroupId: group.id })
      .where(eq(matchRequests.id, r.id));
  }

  return group.id;
}
