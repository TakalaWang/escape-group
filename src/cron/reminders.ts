import { db } from "../db/client.js";
import { groups, groupMembers, users } from "../db/schema.js";
import { eq, and, gte, lte } from "drizzle-orm";
import { getLineClient } from "../line/client.js";

export async function runReminders(): Promise<void> {
  const now = new Date();
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  // Find groups happening in the next 24 hours
  const upcomingGroups = await db
    .select({
      id: groups.id,
      roomName: groups.roomName,
      studio: groups.studio,
      datetime: groups.datetime,
      hostId: groups.hostId,
    })
    .from(groups)
    .where(
      and(eq(groups.status, "open"), gte(groups.datetime, now), lte(groups.datetime, tomorrow))
    );

  const client = getLineClient();

  for (const group of upcomingGroups) {
    // Get all members
    const members = await db
      .select({ lineUserId: users.lineUserId })
      .from(groupMembers)
      .innerJoin(users, eq(groupMembers.userId, users.id))
      .where(eq(groupMembers.groupId, group.id));

    // Get host
    const [host] = await db
      .select({ lineUserId: users.lineUserId })
      .from(users)
      .where(eq(users.id, group.hostId));

    const allUserIds = [host?.lineUserId, ...members.map((m) => m.lineUserId)].filter(
      Boolean
    ) as string[];

    const datetime = group.datetime
      ? `${group.datetime.getMonth() + 1}/${group.datetime.getDate()} ${group.datetime.getHours().toString().padStart(2, "0")}:${group.datetime.getMinutes().toString().padStart(2, "0")}`
      : "時間未定";

    const text = `⏰ 提醒：「${group.roomName}」${group.studio ? ` (${group.studio})` : ""} 將在 ${datetime} 開始！`;

    for (const uid of allUserIds) {
      try {
        await client.pushMessage({ to: uid, messages: [{ type: "text", text }] });
      } catch (err) {
        console.error(`Failed to send reminder to ${uid}:`, err);
      }
    }
  }

  console.log(`Reminders sent for ${upcomingGroups.length} groups`);
}
