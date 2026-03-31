import type { WebhookEvent } from "@line/bot-sdk";
import { handlePostback } from "./postback.js";
import { handleFollow } from "./follow.js";
import { handleJoinEvent } from "./join.js";
import { handleMessage } from "./message.js";

export async function handleWebhookEvents(events: WebhookEvent[]): Promise<void> {
  for (const event of events) {
    try {
      switch (event.type) {
        case "postback":
          await handlePostback(event);
          break;
        case "follow":
          await handleFollow(event);
          break;
        case "join":
          await handleJoinEvent(event);
          break;
        case "message":
          await handleMessage(event);
          break;
      }
    } catch (err) {
      console.error(`Error handling ${event.type} event:`, err);
    }
  }
}
