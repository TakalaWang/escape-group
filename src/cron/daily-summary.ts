import { db } from "../db/client.js";
import { groups } from "../db/schema.js";
import { eq, sql, asc } from "drizzle-orm";
import { getLineClient } from "../line/client.js";
import { buildSummaryCard } from "../line/flex/summary.js";

export async function runDailySummary(lineGroupId: string): Promise<void> {
  const openGroups = await db
    .select({
      id: groups.id,
      roomName: groups.roomName,
      datetime: groups.datetime,
      maxMembers: groups.maxMembers,
      prefilledMembers: groups.prefilledMembers,
      memberCount: sql<number>`(
        SELECT count(*)::int FROM group_members
        WHERE group_members.group_id = ${groups.id}
      )`,
    })
    .from(groups)
    .where(eq(groups.status, "open"))
    .orderBy(asc(groups.datetime), asc(groups.createdAt));

  const summaryGroups = openGroups.map((g) => ({
    id: g.id,
    roomName: g.roomName,
    datetime: g.datetime,
    maxMembers: g.maxMembers,
    currentMembers: g.prefilledMembers + (g.memberCount ?? 0),
  }));

  const card = buildSummaryCard(summaryGroups);
  const client = getLineClient();
  await client.pushMessage({ to: lineGroupId, messages: [card] });

  console.log(`Daily summary sent: ${summaryGroups.length} groups`);
}
