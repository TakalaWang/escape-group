import type { messagingApi } from "@line/bot-sdk";

type SummaryGroup = {
  id: string;
  roomName: string;
  studio?: string | null;
  location?: string | null;
  datetime: Date | null;
  minMembers?: number | null;
  maxMembers: number;
  currentMembers: number;
  hostName?: string;
  price?: number | null;
};

function formatDate(date: Date): string {
  const days = ["日", "一", "二", "三", "四", "五", "六"];
  const m = date.getMonth() + 1;
  const d = date.getDate();
  const day = days[date.getDay()];
  const h = date.getHours().toString().padStart(2, "0");
  const min = date.getMinutes().toString().padStart(2, "0");
  return `${m}/${d} (${day}) ${h}:${min}`;
}

function buildBubble(g: SummaryGroup): messagingApi.FlexBubble {
  const remaining = g.maxMembers - g.currentMembers;
  const bodyContents: messagingApi.FlexComponent[] = [
    { type: "text", text: g.roomName, weight: "bold", size: "lg", wrap: true },
  ];

  if (g.studio) {
    bodyContents.push({
      type: "text",
      text: g.studio,
      size: "xs",
      color: "#888888",
      margin: "sm",
    });
  }

  if (g.datetime) {
    bodyContents.push({
      type: "box",
      layout: "horizontal",
      margin: "lg",
      contents: [
        { type: "text", text: "📅", size: "sm", flex: 0 },
        { type: "text", text: formatDate(g.datetime), size: "sm", margin: "sm" },
      ],
    });
  }

  if (g.price) {
    bodyContents.push({
      type: "box",
      layout: "horizontal",
      margin: "md",
      contents: [
        { type: "text", text: "💰", size: "sm", flex: 0 },
        { type: "text", text: `${g.price} 元/人`, size: "sm", margin: "sm" },
      ],
    });
  }

  bodyContents.push({
    type: "box",
    layout: "horizontal",
    margin: "md",
    contents: [
      { type: "text", text: "👥", size: "sm", flex: 0 },
      {
        type: "text",
        text: `${g.currentMembers}/${g.maxMembers} 人（還差 ${remaining} 人）${g.minMembers ? ` · ${g.minMembers}人成團` : ""}`,
        size: "sm",
        margin: "sm",
      },
    ],
  });

  if (g.hostName) {
    bodyContents.push({
      type: "text",
      text: `團主：${g.hostName}`,
      size: "xs",
      color: "#aaaaaa",
      margin: "md",
    });
  }

  return {
    type: "bubble",
    size: "kilo",
    body: { type: "box", layout: "vertical", contents: bodyContents },
    footer: {
      type: "box",
      layout: "vertical",
      contents: [
        {
          type: "button",
          style: "primary",
          color: "#06C755",
          action: {
            type: "postback",
            label: "我要加入",
            data: `action=join&groupId=${g.id}`,
          },
        },
      ],
    },
  };
}

export function buildSummaryCards(groups: SummaryGroup[]): messagingApi.FlexMessage[] {
  if (groups.length === 0) {
    return [
      {
        type: "flex",
        altText: "📋 開團彙整（0 團）",
        contents: {
          type: "bubble",
          body: {
            type: "box",
            layout: "vertical",
            contents: [
              { type: "text", text: "📋 開團彙整", weight: "bold", size: "lg" },
              {
                type: "text",
                text: "目前沒有開放的團",
                size: "sm",
                color: "#888888",
                margin: "lg",
              },
            ],
          },
        },
      },
    ];
  }

  // Split into chunks of 12 (LINE carousel limit)
  const messages: messagingApi.FlexMessage[] = [];
  for (let i = 0; i < groups.length; i += 12) {
    const chunk = groups.slice(i, i + 12);
    messages.push({
      type: "flex",
      altText: `📋 開團彙整（${groups.length} 團開放中）`,
      contents: {
        type: "carousel",
        contents: chunk.map(buildBubble),
      },
    });
  }
  return messages;
}

// Keep the old function for backward compatibility (used by search results in postback handler)
export function buildSummaryCard(groups: SummaryGroup[]): messagingApi.FlexMessage {
  return buildSummaryCards(groups)[0];
}
