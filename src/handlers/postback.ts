import type { PostbackEvent } from "@line/bot-sdk";
import { getLineClient } from "../line/client.js";
import { upsertUser } from "../services/user.js";
import { joinGroup } from "../services/member.js";
import { getGroupById, getGroupMemberCount } from "../services/group.js";

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
      };

      if (!result.ok) {
        await client.replyMessage({
          replyToken: event.replyToken,
          messages: [{ type: "text", text: messages[result.reason] }],
        });
        return;
      }

      const group = await getGroupById(groupId);
      const memberCount = await getGroupMemberCount(groupId);
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
      break;
    }
  }
}
