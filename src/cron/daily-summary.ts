import { db } from "../db/client.js";
import { groups, users, subscriptions } from "../db/schema.js";
import { eq, sql, asc } from "drizzle-orm";
import { getLineClient } from "../line/client.js";
import { buildSummaryCards } from "../line/flex/summary.js";

export async function runDailySummary(lineGroupId: string): Promise<void> {
  const openGroups = await db
    .select({
      id: groups.id,
      roomName: groups.roomName,
      studio: groups.studio,
      location: groups.location,
      datetime: groups.datetime,
      duration: groups.duration,
      minMembers: groups.minMembers,
      maxMembers: groups.maxMembers,
      prefilledMembers: groups.prefilledMembers,
      price: groups.price,
      hostId: groups.hostId,
      memberCount: sql<number>`(
        SELECT count(*)::int FROM group_members
        WHERE group_members.group_id = ${groups.id}
      )`,
    })
    .from(groups)
    .where(eq(groups.status, "open"))
    .orderBy(asc(groups.datetime), asc(groups.createdAt));

  // Get host names
  const hostIds = [...new Set(openGroups.map((g) => g.hostId))];
  const hosts =
    hostIds.length > 0
      ? await db.select({ id: users.id, displayName: users.displayName }).from(users)
      : [];
  const hostMap = new Map(hosts.map((h) => [h.id, h.displayName]));

  const summaryGroups = openGroups.map((g) => ({
    id: g.id,
    roomName: g.roomName,
    studio: g.studio,
    location: g.location,
    datetime: g.datetime,
    duration: g.duration,
    minMembers: g.minMembers,
    maxMembers: g.maxMembers,
    currentMembers: g.prefilledMembers + (g.memberCount ?? 0),
    price: g.price,
    hostName: hostMap.get(g.hostId) ?? undefined,
  }));

  const client = getLineClient();

  // Send to big group
  const cards = buildSummaryCards(summaryGroups);
  for (const card of cards) {
    await client.pushMessage({ to: lineGroupId, messages: [card] });
  }
  console.log(`Daily summary sent to group: ${summaryGroups.length} groups`);

  // Personal notifications for subscribers
  const allSubs = await db
    .select({
      userId: subscriptions.userId,
      type: subscriptions.type,
      value: subscriptions.value,
      lineUserId: users.lineUserId,
    })
    .from(subscriptions)
    .innerJoin(users, eq(subscriptions.userId, users.id));

  // Group subscriptions by user
  const userSubs = new Map<
    string,
    { lineUserId: string; subs: { type: string; value: string }[] }
  >();
  for (const sub of allSubs) {
    if (!userSubs.has(sub.userId)) {
      userSubs.set(sub.userId, { lineUserId: sub.lineUserId, subs: [] });
    }
    userSubs.get(sub.userId)!.subs.push({ type: sub.type, value: sub.value });
  }

  // For each subscriber, find matching groups and send personal summary
  for (const [, { lineUserId, subs }] of userSubs) {
    const matched = summaryGroups.filter((g) =>
      subs.some((s) => {
        if (s.type === "location" && g.location === s.value) return true;
        if (s.type === "keyword") {
          const kw = s.value.toLowerCase();
          if (g.roomName.toLowerCase().includes(kw) || g.studio?.toLowerCase().includes(kw))
            return true;
        }
        if (s.type === "price" && g.price != null) {
          const [pMin, pMax] = s.value.split("-").map(Number);
          if ((!pMin || g.price >= pMin) && (!pMax || g.price <= pMax)) return true;
        }
        if (s.type === "weekday" && g.datetime) {
          const dayOfWeek = g.datetime.getDay();
          const subscribedDays = s.value.split(",").map(Number);
          if (subscribedDays.includes(dayOfWeek)) return true;
        }
        return false;
      })
    );

    if (matched.length === 0) continue;

    const personalCards = buildSummaryCards(matched);
    for (const card of personalCards) {
      // Override altText for personal notification
      card.altText = `🔔 你訂閱的團有 ${matched.length} 個開放中`;
      try {
        await client.pushMessage({ to: lineUserId, messages: [card] });
      } catch (err) {
        console.error(`Failed to send personal summary to ${lineUserId}:`, err);
      }
    }
  }

  console.log(`Personal summaries sent to ${userSubs.size} subscribers`);
}
