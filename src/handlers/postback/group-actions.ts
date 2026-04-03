import type { PostbackEvent } from "@line/bot-sdk";
import type { messagingApi } from "@line/bot-sdk";
import { getLineClient } from "../../line/client.js";
import { upsertUser } from "../../services/user.js";
import { joinGroup, leaveGroup, kickMember } from "../../services/member.js";
import {
  getGroupById,
  getGroupMemberCount,
  cancelGroup,
  getGroupMembers,
} from "../../services/group.js";
import {
  buildJoinNotification,
  buildGroupFullNotification,
  buildLeaveRequestNotification,
} from "../../line/flex/notifications.js";
import { formatDate } from "../../line/flex/shared.js";
import { db } from "../../db/client.js";
import { users } from "../../db/schema.js";
import { eq } from "drizzle-orm";

export async function handleJoin(
  event: PostbackEvent,
  data: URLSearchParams,
  client: messagingApi.MessagingApiClient
): Promise<void> {
  const groupId = data.get("groupId");
  const userId = event.source.userId!;
  if (!groupId) return;

  const user = await upsertUser(userId);
  const result = await joinGroup(groupId, user.id);

  if (!result.ok) {
    const messages: Record<string, string> = {
      not_found: "找不到這個團，可能已被取消。",
      full: "這個團已經額滿了！",
      already_joined: "你已經加入這個團了。",
      cancelled: "這個團已被取消。",
      is_host: "你是團主，不需要加入自己的團。",
    };
    await client.replyMessage({
      replyToken: event.replyToken,
      messages: [{ type: "text", text: messages[result.reason] }],
    });
    return;
  }

  const [group, memberCount] = await Promise.all([
    getGroupById(groupId),
    getGroupMemberCount(groupId),
  ]);
  const current = (group?.prefilledMembers ?? 1) + memberCount;

  await client.replyMessage({
    replyToken: event.replyToken,
    messages: [
      {
        type: "text",
        text: `✅ 成功加入「${group?.roomName}」！目前 ${current}/${group?.maxMembers} 人。`,
      },
    ],
  });

  // Notify host (non-blocking)
  try {
    const [host] = await db.select().from(users).where(eq(users.id, group!.hostId)).limit(1);
    if (host) {
      const joinerName = user.displayName || "某人";
      if (result.groupFull) {
        const dateStr = group!.datetime ? formatDate(group!.datetime) : "";
        await client.pushMessage({
          to: host.lineUserId,
          messages: [buildGroupFullNotification(group!.roomName, group!.maxMembers, dateStr)],
        });
      } else {
        await client.pushMessage({
          to: host.lineUserId,
          messages: [
            buildJoinNotification(joinerName, group!.roomName, current, group!.maxMembers),
          ],
        });
      }
    }
  } catch (e) {
    console.error("Failed to notify host:", e);
  }
}

export async function handleCancelGroup(
  event: PostbackEvent,
  data: URLSearchParams,
  client: messagingApi.MessagingApiClient
): Promise<void> {
  const groupId = data.get("groupId");
  const userId = event.source.userId!;
  if (!groupId) return;

  const user = await upsertUser(userId);
  const group = await getGroupById(groupId);
  if (!group) return;

  const members = await getGroupMembers(groupId);
  await cancelGroup(groupId, user.id);

  for (const member of members) {
    try {
      await client.pushMessage({
        to: member.lineUserId,
        messages: [{ type: "text", text: `❌ 「${group.roomName}」已被團主取消。` }],
      });
    } catch (e) {
      console.error("Failed to notify member of cancellation:", e);
    }
  }

  await client.replyMessage({
    replyToken: event.replyToken,
    messages: [{ type: "text", text: "✅ 已取消此團，已通知所有成員。" }],
  });
}

export async function handleLeave(
  event: PostbackEvent,
  data: URLSearchParams,
  client: messagingApi.MessagingApiClient
): Promise<void> {
  const groupId = data.get("groupId");
  const userId = event.source.userId!;
  if (!groupId) return;

  const user = await upsertUser(userId);
  const group = await getGroupById(groupId);
  if (!group) {
    await client.replyMessage({
      replyToken: event.replyToken,
      messages: [{ type: "text", text: "找不到這個團。" }],
    });
    return;
  }

  const [host] = await db.select().from(users).where(eq(users.id, group.hostId)).limit(1);
  if (host) {
    await client.pushMessage({
      to: host.lineUserId,
      messages: [
        buildLeaveRequestNotification(
          user.displayName,
          group.roomName,
          groupId,
          user.id,
          user.lineUserId
        ),
      ],
    });
  }
  await client.replyMessage({
    replyToken: event.replyToken,
    messages: [{ type: "text", text: "已向團主發送退團申請，請等待回覆。" }],
  });
}

export async function handleApproveLeave(
  event: PostbackEvent,
  data: URLSearchParams,
  client: messagingApi.MessagingApiClient
): Promise<void> {
  const groupId = data.get("groupId");
  const memberUserId = data.get("userId");
  if (!groupId || !memberUserId) return;

  const result = await leaveGroup(groupId, memberUserId);
  const group = await getGroupById(groupId);
  if (result.ok) {
    const [member] = await db.select().from(users).where(eq(users.id, memberUserId)).limit(1);
    if (member) {
      await client.pushMessage({
        to: member.lineUserId,
        messages: [{ type: "text", text: `✅ 團主已同意你退出「${group?.roomName}」。` }],
      });
    }
    await client.replyMessage({
      replyToken: event.replyToken,
      messages: [{ type: "text", text: "✅ 已同意退團。" }],
    });
  }
}

export async function handleRejectLeave(
  event: PostbackEvent,
  data: URLSearchParams,
  client: messagingApi.MessagingApiClient
): Promise<void> {
  const groupId = data.get("groupId");
  const memberLineUserId = data.get("memberId");
  if (!groupId || !memberLineUserId) return;

  const group = await getGroupById(groupId);
  await client.pushMessage({
    to: memberLineUserId,
    messages: [{ type: "text", text: `❌ 團主拒絕了你退出「${group?.roomName}」的申請。` }],
  });
  await client.replyMessage({
    replyToken: event.replyToken,
    messages: [{ type: "text", text: "已拒絕退團申請。" }],
  });
}

export async function handleManageMembers(
  event: PostbackEvent,
  data: URLSearchParams,
  client: messagingApi.MessagingApiClient
): Promise<void> {
  const groupId = data.get("groupId");
  if (!groupId) return;

  const group = await getGroupById(groupId);
  if (!group) return;
  const members = await getGroupMembers(groupId);

  if (members.length === 0) {
    await client.replyMessage({
      replyToken: event.replyToken,
      messages: [{ type: "text", text: "目前沒有成員加入。" }],
    });
    return;
  }

  const memberButtons = members.map((m) => ({
    type: "box" as const,
    layout: "horizontal" as const,
    margin: "md" as const,
    contents: [
      { type: "text" as const, text: m.displayName, size: "sm" as const, flex: 3 },
      {
        type: "button" as const,
        style: "secondary" as const,
        height: "sm" as const,
        flex: 2,
        action: {
          type: "postback" as const,
          label: "踢出",
          data: `action=kick&groupId=${groupId}&memberId=${m.id}`,
        },
      },
    ],
  }));

  await client.replyMessage({
    replyToken: event.replyToken,
    messages: [
      {
        type: "flex",
        altText: "成員管理",
        contents: {
          type: "bubble",
          body: {
            type: "box",
            layout: "vertical",
            contents: [
              { type: "text", text: `👥 ${group.roomName}`, weight: "bold", size: "lg" },
              {
                type: "text",
                text: `成員管理（${members.length} 人）`,
                size: "xs",
                color: "#888888",
                margin: "sm",
              },
              { type: "separator", margin: "md" },
              ...memberButtons,
            ],
          },
        } as any,
      },
    ],
  });
}

export async function handleKick(
  event: PostbackEvent,
  data: URLSearchParams,
  client: messagingApi.MessagingApiClient
): Promise<void> {
  const groupId = data.get("groupId");
  const memberId = data.get("memberId");
  const userId = event.source.userId!;
  if (!groupId || !memberId) return;

  const user = await upsertUser(userId);
  const result = await kickMember(groupId, memberId, user.id);
  if (!result.ok) {
    await client.replyMessage({
      replyToken: event.replyToken,
      messages: [{ type: "text", text: "操作失敗：" + (result.reason || "unknown") }],
    });
    return;
  }

  const group = await getGroupById(groupId);
  const [kicked] = await db.select().from(users).where(eq(users.id, memberId)).limit(1);
  if (kicked) {
    try {
      await client.pushMessage({
        to: kicked.lineUserId,
        messages: [{ type: "text", text: `你已被移出「${group?.roomName}」。` }],
      });
    } catch (e) {
      console.error("Failed to notify kicked member:", e);
    }
  }
  await client.replyMessage({
    replyToken: event.replyToken,
    messages: [{ type: "text", text: `✅ 已將 ${kicked?.displayName || "成員"} 移出。` }],
  });
}
