import { db } from "./db.js";
import { matchRequests, groups, groupMembers, escapeRooms } from "@escape-group/db/schema";
import { eq, and } from "drizzle-orm";

export const MIN_MATCH_SIZE = 4;

type TimeRange = {
  timeRangeStart: Date;
  timeRangeEnd: Date;
};

/**
 * Find the largest group of requests with overlapping time windows.
 * Pure function — no DB calls. Exported for testing.
 */
export function findBestOverlap<T extends TimeRange>(
  requests: T[],
  minSize: number,
  maxSize: number
): T[] {
  let best: T[] = [];

  for (const anchor of requests) {
    const compatible = requests.filter(
      (r) => r.timeRangeStart <= anchor.timeRangeEnd && r.timeRangeEnd >= anchor.timeRangeStart
    );

    if (compatible.length >= minSize && compatible.length > best.length) {
      best = compatible.slice(0, maxSize);
    }
  }

  return best.length >= minSize ? best : [];
}

/**
 * Compute the common time window and midpoint event time.
 */
export function computeEventTime(group: TimeRange[]): {
  commonStart: Date;
  commonEnd: Date;
  eventTime: Date;
} {
  const commonStart = new Date(Math.max(...group.map((r) => r.timeRangeStart.getTime())));
  const commonEnd = new Date(Math.min(...group.map((r) => r.timeRangeEnd.getTime())));
  const eventTime = new Date((commonStart.getTime() + commonEnd.getTime()) / 2);
  return { commonStart, commonEnd, eventTime };
}

/**
 * Try to match waiting requests for the same escape room with overlapping time ranges.
 * When enough people overlap, auto-create a group.
 */
export async function tryMatch(escapeRoomId: string): Promise<string | null> {
  const waiting = await db
    .select()
    .from(matchRequests)
    .where(and(eq(matchRequests.escapeRoomId, escapeRoomId), eq(matchRequests.status, "waiting")))
    .orderBy(matchRequests.createdAt);

  if (waiting.length < MIN_MATCH_SIZE) return null;

  const [room] = await db.select().from(escapeRooms).where(eq(escapeRooms.id, escapeRoomId));

  const maxSize = room?.maxPlayers ?? 8;

  const bestGroup = findBestOverlap(waiting, MIN_MATCH_SIZE, maxSize);
  if (bestGroup.length === 0) return null;

  const { commonStart, commonEnd, eventTime } = computeEventTime(bestGroup);

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

  await db.insert(groupMembers).values(
    bestGroup.map((r) => ({
      groupId: group.id,
      userId: r.userId,
      status: "accepted" as const,
    }))
  );

  for (const r of bestGroup) {
    await db
      .update(matchRequests)
      .set({ status: "matched", matchedGroupId: group.id })
      .where(eq(matchRequests.id, r.id));
  }

  return group.id;
}
