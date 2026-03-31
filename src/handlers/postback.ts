import type { PostbackEvent } from "@line/bot-sdk";
import { getLineClient } from "../line/client.js";
import { upsertUser } from "../services/user.js";
import { joinGroup, leaveGroup } from "../services/member.js";
import {
  getGroupById,
  getGroupMemberCount,
  getGroupsByHost,
  cancelGroup,
} from "../services/group.js";
import { searchGroups } from "../services/search.js";
import { buildSummaryCard } from "../line/flex/summary.js";
import { buildMyGroupsCard } from "../line/flex/my-groups.js";

export async function handlePostback(event: PostbackEvent): Promise<void> {
  const data = new URLSearchParams(event.postback.data);
  const action = data.get("action");
  const userId = event.source.userId;
  if (!userId) return;

  const client = getLineClient();

  switch (action) {
    case "join": {
      const groupId = data.get("groupId");
      if (!groupId) return;

      const user = await upsertUser(userId);
      const result = await joinGroup(groupId, user.id);

      const messages: Record<string, string> = {
        not_found: "找不到這個團，可能已被取消。",
        full: "這個團已經額滿了！",
        already_joined: "你已經加入這個團了。",
        cancelled: "這個團已被取消。",
        is_host: "你是團主，不需要加入自己的團。",
      };

      if (!result.ok) {
        await client.pushMessage({
          to: userId,
          messages: [{ type: "text", text: messages[result.reason] }],
        });
        return;
      }

      const group = await getGroupById(groupId);
      const memberCount = await getGroupMemberCount(groupId);
      const current = (group?.prefilledMembers ?? 1) + memberCount;

      await client.pushMessage({
        to: userId,
        messages: [
          {
            type: "text",
            text: `✅ 成功加入「${group?.roomName}」！目前 ${current}/${group?.maxMembers} 人。`,
          },
        ],
      });
      break;
    }
    case "search": {
      const results = await searchGroups({});
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
      break;
    }
    case "my_groups": {
      const user = await upsertUser(userId);
      const myGroups = await getGroupsByHost(user.id);
      const card = buildMyGroupsCard(myGroups);
      await client.replyMessage({
        replyToken: event.replyToken,
        messages: [card],
      });
      break;
    }
    case "cancel_group": {
      const groupId = data.get("groupId");
      if (!groupId) return;
      const user = await upsertUser(userId);
      await cancelGroup(groupId, user.id);
      await client.replyMessage({
        replyToken: event.replyToken,
        messages: [{ type: "text", text: "✅ 已取消此團。" }],
      });
      break;
    }
    case "leave": {
      const groupId = data.get("groupId");
      if (!groupId) return;
      const user = await upsertUser(userId);
      const result = await leaveGroup(groupId, user.id);
      if (!result.ok) {
        const msgs: Record<string, string> = {
          not_found: "找不到這個團。",
          not_member: "你不在這個團裡。",
        };
        await client.replyMessage({
          replyToken: event.replyToken,
          messages: [{ type: "text", text: msgs[result.reason] }],
        });
        return;
      }
      await client.replyMessage({
        replyToken: event.replyToken,
        messages: [{ type: "text", text: "✅ 已退出此團。" }],
      });
      break;
    }
  }
}
