import type { JoinEvent } from "@line/bot-sdk";
import { getLineClient } from "../line/client.js";

export async function handleJoinEvent(event: JoinEvent): Promise<void> {
  const groupId = event.source.type === "group" ? event.source.groupId : null;
  if (!groupId) return;

  console.log("Bot joined group:", groupId);

  const client = getLineClient();
  await client.replyMessage({
    replyToken: event.replyToken,
    messages: [{ type: "text", text: `Group ID: ${groupId}` }],
  });
}
