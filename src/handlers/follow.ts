import type { FollowEvent } from "@line/bot-sdk";
import { upsertUser } from "../services/user.js";
import { getLineClient } from "../line/client.js";

export async function handleFollow(event: FollowEvent): Promise<void> {
  const userId = event.source.userId;
  if (!userId) return;

  await upsertUser(userId);

  const client = getLineClient();
  await client.replyMessage({
    replyToken: event.replyToken,
    messages: [
      {
        type: "text",
        text: "歡迎使用密室揪團 Bot！\n\n請使用下方選單來開團或找團。",
      },
    ],
  });
}
