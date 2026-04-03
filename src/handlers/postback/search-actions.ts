import type { PostbackEvent } from "@line/bot-sdk";
import type { messagingApi } from "@line/bot-sdk";
import { searchGroups, buildSearchQuery } from "../../services/search.js";
import { buildSummaryCard } from "../../line/flex/summary.js";
import { setPendingSearch } from "../message.js";

export async function handleSearch(
  event: PostbackEvent,
  data: URLSearchParams,
  client: messagingApi.MessagingApiClient
): Promise<void> {
  const location = data.get("location");
  const keyword = data.get("keyword");

  if (!location && !keyword && !data.has("all")) {
    await client.replyMessage({
      replyToken: event.replyToken,
      messages: [
        {
          type: "flex",
          altText: "找團篩選",
          contents: {
            type: "bubble",
            body: {
              type: "box",
              layout: "vertical",
              contents: [
                { type: "text", text: "🔍 找團", weight: "bold", size: "lg" },
                { type: "separator", margin: "md" },
                {
                  type: "text",
                  text: "選擇篩選方式：",
                  size: "sm",
                  margin: "lg",
                  color: "#888888",
                },
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
                  action: { type: "postback", label: "依地區篩選", data: "action=search_location" },
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
          } as any,
        },
      ],
    });
    return;
  }

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
  await client.replyMessage({ replyToken: event.replyToken, messages: [card] });
}

export async function handleSearchLocation(
  event: PostbackEvent,
  client: messagingApi.MessagingApiClient
): Promise<void> {
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

  await client.replyMessage({
    replyToken: event.replyToken,
    messages: [
      {
        type: "flex",
        altText: "選擇地區",
        contents: {
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
        } as any,
      },
    ],
  });
}

export async function handleSearchKeyword(
  event: PostbackEvent,
  client: messagingApi.MessagingApiClient
): Promise<void> {
  await setPendingSearch(event.source.userId!);
  await client.replyMessage({
    replyToken: event.replyToken,
    messages: [{ type: "text", text: "請輸入搜尋關鍵字（密室名稱或工作室）：" }],
  });
}

export async function handleCopyAllGroups(
  event: PostbackEvent,
  client: messagingApi.MessagingApiClient
): Promise<void> {
  const { buildTextSummary } = await import("../../cron/daily-summary.js");
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
              { type: "text", text: `📋 ${allOpen.length} 團開放中`, weight: "bold", size: "sm" },
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
                  type: "clipboard",
                  label: "複製全部團 📋",
                  clipboardText: text,
                },
              },
            ],
          },
        } as any,
      },
    ],
  });
}
