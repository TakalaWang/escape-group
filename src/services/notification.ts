import { getLineClient } from "../line/client.js";
import { buildGroupCard, type GroupCardInput } from "../line/flex/group-card.js";
import { db } from "../db/client.js";
import { subscriptions, users } from "../db/schema.js";
import { eq } from "drizzle-orm";

export async function notifyAdmins(excludeUserId: string, cardData: GroupCardInput): Promise<void> {
  const adminIds = (process.env.ADMIN_USER_IDS ?? "").split(",").filter(Boolean);
  const client = getLineClient();

  for (const adminId of adminIds) {
    if (adminId === excludeUserId) continue;
    try {
      await client.pushMessage({ to: adminId, messages: [buildGroupCard(cardData)] });
    } catch (err) {
      console.error("Failed to notify admin:", err);
    }
  }
}

export async function notifySubscribers(
  cardData: GroupCardInput,
  groupInput: {
    roomName?: string;
    studio?: string;
    location?: string;
    price?: number;
    datetime?: string;
  },
  excludeLineUserId: string
): Promise<void> {
  const allSubs = await db
    .select({
      userId: subscriptions.userId,
      type: subscriptions.type,
      value: subscriptions.value,
      lineUserId: users.lineUserId,
    })
    .from(subscriptions)
    .innerJoin(users, eq(subscriptions.userId, users.id));

  const client = getLineClient();
  const notified = new Set<string>();

  for (const sub of allSubs) {
    if (sub.lineUserId === excludeLineUserId || notified.has(sub.lineUserId)) continue;

    let matches = false;
    if (sub.type === "location" && groupInput.location === sub.value) matches = true;
    if (sub.type === "keyword") {
      const kw = sub.value.toLowerCase();
      if (
        groupInput.roomName?.toLowerCase().includes(kw) ||
        groupInput.studio?.toLowerCase().includes(kw)
      )
        matches = true;
    }
    if (sub.type === "price" && groupInput.price != null) {
      const [pMin, pMax] = sub.value.split("-").map(Number);
      if ((!pMin || groupInput.price >= pMin) && (!pMax || groupInput.price <= pMax))
        matches = true;
    }
    if (sub.type === "weekday" && groupInput.datetime) {
      const groupDate = new Date(groupInput.datetime);
      const dayOfWeek = groupDate.getDay();
      const subscribedDays = sub.value.split(",").map(Number);
      if (subscribedDays.includes(dayOfWeek)) matches = true;
    }

    if (!matches) continue;
    notified.add(sub.lineUserId);

    try {
      await client.pushMessage({
        to: sub.lineUserId,
        messages: [{ type: "text", text: "🔔 新團符合你的訂閱！" }, buildGroupCard(cardData)],
      });
    } catch (e) {
      console.error("Failed to notify subscriber:", e);
    }
  }
}
