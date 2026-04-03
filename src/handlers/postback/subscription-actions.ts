import type { PostbackEvent } from "@line/bot-sdk";
import type { messagingApi } from "@line/bot-sdk";
import { upsertUser } from "../../services/user.js";
import { setPendingSubKeyword, setPendingSubPrice } from "../message.js";
import {
  buildSubscriptionMenu,
  buildMySubscriptions,
  buildLocationPicker,
} from "../../line/flex/subscription-menu.js";
import { db } from "../../db/client.js";
import { subscriptions } from "../../db/schema.js";
import { eq, and } from "drizzle-orm";

export async function handleSubMenu(
  event: PostbackEvent,
  client: messagingApi.MessagingApiClient
): Promise<void> {
  const menu = buildSubscriptionMenu();
  await client.replyMessage({ replyToken: event.replyToken, messages: [menu] });
}

export async function handleSubLocation(
  event: PostbackEvent,
  client: messagingApi.MessagingApiClient
): Promise<void> {
  const picker = buildLocationPicker();
  await client.replyMessage({ replyToken: event.replyToken, messages: [picker] });
}

export async function handleSubKeyword(
  event: PostbackEvent,
  client: messagingApi.MessagingApiClient
): Promise<void> {
  await setPendingSubKeyword(event.source.userId!);
  await client.replyMessage({
    replyToken: event.replyToken,
    messages: [{ type: "text", text: "請輸入要訂閱的關鍵字（密室名稱或工作室）：" }],
  });
}

export async function handleSubPrice(
  event: PostbackEvent,
  client: messagingApi.MessagingApiClient
): Promise<void> {
  await setPendingSubPrice(event.source.userId!);
  await client.replyMessage({
    replyToken: event.replyToken,
    messages: [{ type: "text", text: "請輸入價格上限（元）：" }],
  });
}

export async function handleSubscribe(
  event: PostbackEvent,
  data: URLSearchParams,
  client: messagingApi.MessagingApiClient
): Promise<void> {
  const type = data.get("type");
  const value = data.get("value");
  if (!type || !value) return;

  const user = await upsertUser(event.source.userId!);

  const existing = await db
    .select()
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.userId, user.id),
        eq(subscriptions.type, type as "location" | "keyword" | "price"),
        eq(subscriptions.value, value)
      )
    )
    .limit(1);

  if (existing.length > 0) {
    await client.replyMessage({
      replyToken: event.replyToken,
      messages: [{ type: "text", text: "你已經訂閱過了。" }],
    });
    return;
  }

  await db.insert(subscriptions).values({
    userId: user.id,
    type: type as "location" | "keyword" | "price",
    value,
  });

  const label = type === "location" ? `地區：${value}` : `關鍵字：${value}`;
  await client.replyMessage({
    replyToken: event.replyToken,
    messages: [{ type: "text", text: `✅ 已訂閱「${label}」，有新團會通知你。` }],
  });
}

export async function handleMySubscriptions(
  event: PostbackEvent,
  client: messagingApi.MessagingApiClient
): Promise<void> {
  const user = await upsertUser(event.source.userId!);
  const subs = await db.select().from(subscriptions).where(eq(subscriptions.userId, user.id));
  const card = buildMySubscriptions(subs);
  await client.replyMessage({ replyToken: event.replyToken, messages: [card] });
}

export async function handleUnsub(
  event: PostbackEvent,
  data: URLSearchParams,
  client: messagingApi.MessagingApiClient
): Promise<void> {
  const subId = data.get("subId");
  if (!subId) return;
  await db.delete(subscriptions).where(eq(subscriptions.id, subId));
  await client.replyMessage({
    replyToken: event.replyToken,
    messages: [{ type: "text", text: "✅ 已取消訂閱。" }],
  });
}
