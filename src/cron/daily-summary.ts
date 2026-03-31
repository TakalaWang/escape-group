import { db } from "../db/client.js";
import { groups, users, subscriptions } from "../db/schema.js";
import { eq, sql, asc } from "drizzle-orm";
import { getLineClient } from "../line/client.js";
import { buildSummaryCards } from "../line/flex/summary.js";

const LOCATION_LABELS: Record<string, string> = {
  keelung: "基隆",
  taipei: "台北",
  new_taipei: "新北",
  taoyuan: "桃園",
  hsinchu: "新竹",
  miaoli: "苗栗",
  taichung: "台中",
  changhua: "彰化",
  nantou: "南投",
  yunlin: "雲林",
  chiayi: "嘉義",
  tainan: "台南",
  kaohsiung: "高雄",
  pingtung: "屏東",
  yilan: "宜蘭",
  hualien: "花蓮",
  taitung: "台東",
  penghu: "澎湖",
  kinmen: "金門",
  matsu: "馬祖",
};

const DAYS = ["日", "一", "二", "三", "四", "五", "六"];

function formatDate(d: Date): string {
  return `${d.getMonth() + 1}/${d.getDate()}(${DAYS[d.getDay()]}) ${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
}

type SummaryGroup = {
  id: string;
  roomName: string;
  studio: string | null;
  location: string | null;
  datetime: Date | null;
  duration: number | null;
  minMembers: number | null;
  maxMembers: number;
  currentMembers: number;
  price: number | null;
  hostName?: string;
};

export function buildTextSummary(groups: SummaryGroup[]): string {
  if (groups.length === 0) return "📋 今日開團彙整\n\n目前沒有開放的團";

  let text = `📋 開團彙整（${groups.length} 團開放中）\n`;
  text += "─────────────\n";

  // Group by date
  const byDate = new Map<string, SummaryGroup[]>();
  const noDate: SummaryGroup[] = [];

  for (const g of groups) {
    if (g.datetime) {
      const key = `${g.datetime.getMonth() + 1}/${g.datetime.getDate()}(${DAYS[g.datetime.getDay()]})`;
      if (!byDate.has(key)) byDate.set(key, []);
      byDate.get(key)!.push(g);
    } else {
      noDate.push(g);
    }
  }

  for (const [date, gs] of byDate) {
    text += `\n📅 ${date}\n`;
    for (const g of gs) {
      const remaining = g.maxMembers - g.currentMembers;
      const time = g.datetime
        ? `${g.datetime.getHours().toString().padStart(2, "0")}:${g.datetime.getMinutes().toString().padStart(2, "0")}`
        : "";
      const loc = g.location ? LOCATION_LABELS[g.location] || g.location : "";
      const price = g.price ? `$${g.price}` : "";
      const dur = g.duration ? `${g.duration}分` : "";
      const info = [time, loc, price, dur].filter(Boolean).join(" · ");

      text += `\n▸ ${g.roomName}`;
      if (g.studio) text += `（${g.studio}）`;
      text += `\n  ${info}`;
      text += `\n  ${g.currentMembers}/${g.maxMembers}人 — 還差 ${remaining} 人`;
      if (g.hostName) text += ` · 團主：${g.hostName}`;
      text += "\n";
    }
  }

  if (noDate.length > 0) {
    text += "\n📅 時間未定\n";
    for (const g of noDate) {
      const remaining = g.maxMembers - g.currentMembers;
      text += `\n▸ ${g.roomName}`;
      if (g.studio) text += `（${g.studio}）`;
      text += `\n  ${g.currentMembers}/${g.maxMembers}人 — 還差 ${remaining} 人`;
      text += "\n";
    }
  }

  text += "\n─────────────\n";
  text += "💡 加 Bot 好友即可開團/找團/訂閱通知";

  return text;
}

export async function runDailySummary(): Promise<void> {
  const openGroups = await db
    .select({
      id: groups.id,
      roomName: groups.roomName,
      studio: groups.studio,
      location: groups.location,
      datetime: groups.datetime,
      duration: groups.duration,
      minMembers: groups.minMembers,
      maxMembers: groups.maxMembers,
      prefilledMembers: groups.prefilledMembers,
      price: groups.price,
      hostId: groups.hostId,
      memberCount: sql<number>`(
        SELECT count(*)::int FROM group_members
        WHERE group_members.group_id = ${groups.id}
      )`,
    })
    .from(groups)
    .where(eq(groups.status, "open"))
    .orderBy(asc(groups.datetime), asc(groups.createdAt));

  const hostIds = [...new Set(openGroups.map((g) => g.hostId))];
  const hosts =
    hostIds.length > 0
      ? await db.select({ id: users.id, displayName: users.displayName }).from(users)
      : [];
  const hostMap = new Map(hosts.map((h) => [h.id, h.displayName]));

  const summaryGroups: SummaryGroup[] = openGroups.map((g) => ({
    id: g.id,
    roomName: g.roomName,
    studio: g.studio,
    location: g.location,
    datetime: g.datetime,
    duration: g.duration,
    minMembers: g.minMembers,
    maxMembers: g.maxMembers,
    currentMembers: g.prefilledMembers + (g.memberCount ?? 0),
    price: g.price,
    hostName: hostMap.get(g.hostId) ?? undefined,
  }));

  const client = getLineClient();

  // Send plain text summary to admins (for forwarding to OpenChat)
  const adminIds = (process.env.ADMIN_USER_IDS ?? "").split(",").filter(Boolean);
  if (adminIds.length > 0 && summaryGroups.length > 0) {
    const textSummary = buildTextSummary(summaryGroups);
    for (const adminId of adminIds) {
      try {
        await client.pushMessage({
          to: adminId,
          messages: [
            { type: "text", text: textSummary },
            {
              type: "flex",
              altText: "點擊分享到 OpenChat",
              contents: {
                type: "bubble",
                size: "nano",
                body: {
                  type: "box",
                  layout: "vertical",
                  contents: [
                    {
                      type: "button",
                      style: "primary",
                      color: "#06C755",
                      action: {
                        type: "uri",
                        label: "分享到 OpenChat",
                        uri: "https://liff.line.me/2009659299-rbF8C1zz?share=all",
                      },
                    },
                  ],
                },
              },
            },
          ],
        });
      } catch (err) {
        console.error(`Failed to send text summary to admin ${adminId}:`, err);
      }
    }
    console.log(`Text summary sent to ${adminIds.length} admins`);
  }

  // Send carousel to all bot followers who have subscriptions
  const allSubs = await db
    .select({
      userId: subscriptions.userId,
      type: subscriptions.type,
      value: subscriptions.value,
      lineUserId: users.lineUserId,
    })
    .from(subscriptions)
    .innerJoin(users, eq(subscriptions.userId, users.id));

  const userSubs = new Map<
    string,
    { lineUserId: string; subs: { type: string; value: string }[] }
  >();
  for (const sub of allSubs) {
    if (!userSubs.has(sub.userId)) {
      userSubs.set(sub.userId, { lineUserId: sub.lineUserId, subs: [] });
    }
    userSubs.get(sub.userId)!.subs.push({ type: sub.type, value: sub.value });
  }

  for (const [, { lineUserId, subs }] of userSubs) {
    const matched = summaryGroups.filter((g) =>
      subs.some((s) => {
        if (s.type === "location" && g.location === s.value) return true;
        if (s.type === "keyword") {
          const kw = s.value.toLowerCase();
          if (g.roomName.toLowerCase().includes(kw) || g.studio?.toLowerCase().includes(kw))
            return true;
        }
        if (s.type === "price" && g.price != null) {
          const [pMin, pMax] = s.value.split("-").map(Number);
          if ((!pMin || g.price >= pMin) && (!pMax || g.price <= pMax)) return true;
        }
        if (s.type === "weekday" && g.datetime) {
          const dayOfWeek = g.datetime.getDay();
          const subscribedDays = s.value.split(",").map(Number);
          if (subscribedDays.includes(dayOfWeek)) return true;
        }
        return false;
      })
    );

    if (matched.length === 0) continue;

    const personalCards = buildSummaryCards(matched);
    for (const card of personalCards) {
      card.altText = `🔔 你訂閱的團有 ${matched.length} 個開放中`;
      try {
        await client.pushMessage({ to: lineUserId, messages: [card] });
      } catch (err) {
        console.error(`Failed to send personal summary to ${lineUserId}:`, err);
      }
    }
  }

  console.log(
    `Daily summary: ${summaryGroups.length} groups, ${userSubs.size} subscribers notified`
  );
}
