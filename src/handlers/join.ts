import type { JoinEvent } from "@line/bot-sdk";

export async function handleJoinEvent(event: JoinEvent): Promise<void> {
  const groupId = event.source.type === "group" ? event.source.groupId : null;
  console.log("Bot joined group:", groupId);
}
