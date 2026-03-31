import type { MessageEvent } from "@line/bot-sdk";
import { getLineClient } from "../line/client.js";
import { db } from "../db/client.js";
import { groups, groupMembers, users } from "../db/schema.js";
import { eq, and } from "drizzle-orm";

const pendingSearchKeyword = new Map<string, boolean>();

export function setPendingSearch(userId: string) {
  pendingSearchKeyword.set(userId, true);
}

export async function handleMessage(event: MessageEvent): Promise<void> {
  if (event.message.type !== "text") return;
  if (event.source.type !== "user") return;

  const userId = event.source.userId;
  if (!userId) return;

  const text = (event.message as { type: "text"; text: string }).text;
  const client = getLineClient();

  // Check if user is providing a search keyword
  if (pendingSearchKeyword.has(userId)) {
    pendingSearchKeyword.delete(userId);
    const { searchGroups, buildSearchQuery } = await import("../services/search.js");
    const { buildSummaryCard } = await import("../line/flex/summary.js");

    const results = await searchGroups(buildSearchQuery({ keyword: text }));
    const summaryGroups = results.map((r) => ({
      id: r.id,
      roomName: r.roomName,
      datetime: r.datetime,
      maxMembers: r.maxMembers,
      currentMembers: r.currentMembers,
    }));
    const card = buildSummaryCard(summaryGroups);
    await client.replyMessage({
      replyToken: event.replyToken,
      messages: [card],
    });
    return;
  }

  // Check if it's a LINE group invite link
  const inviteLinkMatch = text.match(/https?:\/\/line\.me\/(?:R\/)?ti\/g\/[A-Za-z0-9_-]+/);
  if (!inviteLinkMatch) return;

  const inviteLink = inviteLinkMatch[0];

  // Find a full group hosted by this user that doesn't have a lineGroupId yet
  const [user] = await db.select().from(users).where(eq(users.lineUserId, userId)).limit(1);
  if (!user) return;

  const fullGroups = await db
    .select()
    .from(groups)
    .where(and(eq(groups.hostId, user.id), eq(groups.status, "full")));

  // Find the most recent full group without a lineGroupId
  const targetGroup = fullGroups.find((g) => !g.lineGroupId);
  if (!targetGroup) {
    await client.replyMessage({
      replyToken: event.replyToken,
      messages: [{ type: "text", text: "找不到需要建群的團。" }],
    });
    return;
  }

  // Save the invite link
  await db.update(groups).set({ lineGroupId: inviteLink }).where(eq(groups.id, targetGroup.id));

  // Get all members
  const members = await db
    .select({ lineUserId: users.lineUserId })
    .from(groupMembers)
    .innerJoin(users, eq(groupMembers.userId, users.id))
    .where(eq(groupMembers.groupId, targetGroup.id));

  // Forward invite link to all members
  for (const member of members) {
    try {
      await client.pushMessage({
        to: member.lineUserId,
        messages: [
          {
            type: "text",
            text: `🔗「${targetGroup.roomName}」的團主已建立群組！\n\n點擊加入：${inviteLink}`,
          },
        ],
      });
    } catch (err) {
      console.error(`Failed to send invite to ${member.lineUserId}:`, err);
    }
  }

  await client.replyMessage({
    replyToken: event.replyToken,
    messages: [
      {
        type: "text",
        text: `✅ 已將群組邀請連結轉發給「${targetGroup.roomName}」的 ${members.length} 位成員！`,
      },
    ],
  });
}
