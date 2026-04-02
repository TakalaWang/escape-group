import type { PostbackEvent } from "@line/bot-sdk";
import { getLineClient } from "../line/client.js";
import { upsertUser } from "../services/user.js";
import { joinGroup, leaveGroup, kickMember } from "../services/member.js";
import {
  getGroupById,
  getGroupMemberCount,
  getGroupsByHost,
  getJoinedGroups,
  cancelGroup,
  getGroupMembers,
} from "../services/group.js";
import { searchGroups, buildSearchQuery } from "../services/search.js";
import { buildSummaryCard } from "../line/flex/summary.js";
import { buildMyGroupsCard, buildJoinedGroupsCard } from "../line/flex/my-groups.js";
import {
  buildJoinNotification,
  buildGroupFullNotification,
  buildLeaveRequestNotification,
} from "../line/flex/notifications.js";
import { db } from "../db/client.js";
import { users, subscriptions } from "../db/schema.js";
import { eq, and } from "drizzle-orm";
import { setPendingSearch } from "./message.js";
import {
  buildSubscriptionMenu,
  buildMySubscriptions,
  buildLocationPicker,
} from "../line/flex/subscription-menu.js";

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

      // Reply to joiner immediately, notify host in background
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
            const days = ["日", "一", "二", "三", "四", "五", "六"];
            const dt = group!.datetime;
            const dateStr = dt
              ? `${dt.getMonth() + 1}/${dt.getDate()}(${days[dt.getDay()]}) ${dt.getHours().toString().padStart(2, "0")}:${dt.getMinutes().toString().padStart(2, "0")}`
              : "";
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
      break;
    }
    case "my_groups": {
      const user = await upsertUser(userId);
      const [myGroups, joined] = await Promise.all([
        getGroupsByHost(user.id),
        getJoinedGroups(user.id),
      ]);
      await client.replyMessage({
        replyToken: event.replyToken,
        messages: [buildMyGroupsCard(myGroups), buildJoinedGroupsCard(joined)],
      });
      break;
    }
    case "cancel_group": {
      const groupId = data.get("groupId");
      if (!groupId) return;
      const user = await upsertUser(userId);
      const group = await getGroupById(groupId);
      if (!group) return;

      // Get members before cancelling
      const members = await getGroupMembers(groupId);
      await cancelGroup(groupId, user.id);

      // Notify all members
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
      break;
    }
    case "leave": {
      const groupId = data.get("groupId");
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
      // Notify host
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
      break;
    }
    case "approve_leave": {
      const groupId = data.get("groupId");
      const memberUserId = data.get("userId");
      if (!groupId || !memberUserId) return;
      const result = await leaveGroup(groupId, memberUserId);
      const group = await getGroupById(groupId);
      if (result.ok) {
        // Notify the member
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
      break;
    }
    case "reject_leave": {
      const groupId = data.get("groupId");
      const memberId = data.get("memberId");
      if (!groupId || !memberId) return;
      const group = await getGroupById(groupId);
      await client.pushMessage({
        to: memberId,
        messages: [{ type: "text", text: `❌ 團主拒絕了你退出「${group?.roomName}」的申請。` }],
      });
      await client.replyMessage({
        replyToken: event.replyToken,
        messages: [{ type: "text", text: "已拒絕退團申請。" }],
      });
      break;
    }
    case "sub_menu": {
      const menu = buildSubscriptionMenu();
      await client.replyMessage({ replyToken: event.replyToken, messages: [menu] });
      break;
    }
    case "sub_location": {
      const picker = buildLocationPicker();
      await client.replyMessage({ replyToken: event.replyToken, messages: [picker] });
      break;
    }
    case "sub_keyword": {
      const { setPendingSubKeyword } = await import("./message.js");
      setPendingSubKeyword(userId);
      await client.replyMessage({
        replyToken: event.replyToken,
        messages: [{ type: "text", text: "請輸入要訂閱的關鍵字（密室名稱或工作室）：" }],
      });
      break;
    }
    case "sub_price": {
      const { setPendingSubPrice } = await import("./message.js");
      setPendingSubPrice(userId);
      await client.replyMessage({
        replyToken: event.replyToken,
        messages: [{ type: "text", text: "請輸入價格上限（元）：" }],
      });
      break;
    }
    case "subscribe": {
      const type = data.get("type"); // "location" or "keyword"
      const value = data.get("value");
      if (!type || !value) return;
      const user = await upsertUser(userId);

      // Check if already subscribed
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
      break;
    }
    case "my_subscriptions": {
      const user = await upsertUser(userId);
      const subs = await db.select().from(subscriptions).where(eq(subscriptions.userId, user.id));
      const card = buildMySubscriptions(subs);
      await client.replyMessage({ replyToken: event.replyToken, messages: [card] });
      break;
    }
    case "unsub": {
      const subId = data.get("subId");
      if (!subId) return;
      await db.delete(subscriptions).where(eq(subscriptions.id, subId));
      await client.replyMessage({
        replyToken: event.replyToken,
        messages: [{ type: "text", text: "✅ 已取消訂閱。" }],
      });
      break;
    }
    case "manage_members": {
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

      const bubble: any = {
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
      };

      await client.replyMessage({
        replyToken: event.replyToken,
        messages: [{ type: "flex", altText: "成員管理", contents: bubble }],
      });
      break;
    }
    case "kick": {
      const groupId = data.get("groupId");
      const memberId = data.get("memberId");
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
      break;
    }
    case "search": {
      // If no filters specified, show filter menu
      const location = data.get("location");
      const keyword = data.get("keyword");

      if (!location && !keyword && !data.has("all")) {
        // Show filter options
        const bubble: any = {
          type: "bubble",
          body: {
            type: "box",
            layout: "vertical",
            contents: [
              { type: "text", text: "🔍 找團", weight: "bold", size: "lg" },
              { type: "separator", margin: "md" },
              { type: "text", text: "選擇篩選方式：", size: "sm", margin: "lg", color: "#888888" },
            ],
          },
          footer: {
            type: "box",
            layout: "vertical",
            spacing: "sm",
            contents: [
              {
                type: "button",
                style: "primary",
                color: "#06C755",
                action: { type: "postback", label: "查看全部", data: "action=search&all=1" },
              },
              {
                type: "button",
                style: "secondary",
                action: {
                  type: "postback",
                  label: "依地區篩選",
                  data: "action=search_location",
                },
              },
              {
                type: "button",
                style: "secondary",
                action: {
                  type: "postback",
                  label: "依關鍵字搜尋",
                  data: "action=search_keyword",
                },
              },
            ],
          },
        };
        await client.replyMessage({
          replyToken: event.replyToken,
          messages: [{ type: "flex", altText: "找團篩選", contents: bubble }],
        });
        return;
      }

      // Search with filters
      const filters: Record<string, string | undefined> = {};
      if (location) filters.location = location;
      if (keyword) filters.keyword = keyword;

      const results = await searchGroups(buildSearchQuery(data.has("all") ? {} : filters));
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
    case "search_location": {
      const locations = [
        ["taipei", "台北"],
        ["new_taipei", "新北"],
        ["taoyuan", "桃園"],
        ["hsinchu", "新竹"],
        ["taichung", "台中"],
        ["tainan", "台南"],
        ["kaohsiung", "高雄"],
        ["yilan", "宜蘭"],
        ["hualien", "花蓮"],
      ];

      const buttons = locations.map(([value, label]) => ({
        type: "button" as const,
        style: "secondary" as const,
        height: "sm" as const,
        action: { type: "postback" as const, label, data: `action=search&location=${value}` },
      }));

      const bubble: any = {
        type: "bubble",
        body: {
          type: "box",
          layout: "vertical",
          contents: [
            { type: "text", text: "📍 選擇地區", weight: "bold", size: "lg" },
            { type: "separator", margin: "md" },
          ],
        },
        footer: {
          type: "box",
          layout: "vertical",
          spacing: "xs",
          contents: buttons,
        },
      };

      await client.replyMessage({
        replyToken: event.replyToken,
        messages: [{ type: "flex", altText: "選擇地區", contents: bubble }],
      });
      break;
    }
    case "search_keyword": {
      setPendingSearch(userId);
      await client.replyMessage({
        replyToken: event.replyToken,
        messages: [{ type: "text", text: "請輸入搜尋關鍵字（密室名稱或工作室）：" }],
      });
      break;
    }
    case "copy_all_groups": {
      const { buildTextSummary } = await import("../cron/daily-summary.js");
      const allOpen = await searchGroups(buildSearchQuery({}));
      const summaryGroups = allOpen.map((r) => ({
        id: r.id,
        roomName: r.roomName,
        studio: (r as any).studio ?? null,
        location: (r as any).location ?? null,
        datetime: r.datetime,
        duration: (r as any).duration ?? null,
        minMembers: null,
        maxMembers: r.maxMembers,
        currentMembers: r.currentMembers,
        price: (r as any).price ?? null,
        hostName: (r as any).hostName ?? undefined,
      }));
      const text = buildTextSummary(summaryGroups);
      await client.replyMessage({
        replyToken: event.replyToken,
        messages: [
          {
            type: "flex",
            altText: "複製全部團",
            contents: {
              type: "bubble",
              size: "kilo",
              body: {
                type: "box",
                layout: "vertical",
                paddingAll: "16px",
                contents: [
                  {
                    type: "text",
                    text: `📋 ${allOpen.length} 團開放中`,
                    weight: "bold",
                    size: "sm",
                  },
                  {
                    type: "text",
                    text: "點下方按鈕複製彙整文字",
                    size: "xs",
                    color: "#888888",
                    margin: "xs",
                  },
                ],
              },
              footer: {
                type: "box",
                layout: "vertical",
                paddingAll: "12px",
                paddingTop: "0px",
                contents: [
                  {
                    type: "button",
                    style: "primary",
                    color: "#06C755",
                    height: "sm",
                    action: {
                      type: "clipboard" as any,
                      label: "複製全部團 📋",
                      clipboardText: text,
                    } as any,
                  },
                ],
              },
            },
          },
        ],
      });
      break;
    }
  }
}
