import type { messagingApi } from "@line/bot-sdk";

type SummaryGroup = {
  id: string;
  roomName: string;
  studio?: string | null;
  location?: string | null;
  datetime: Date | null;
  duration?: number | null;
  minMembers?: number | null;
  maxMembers: number;
  currentMembers: number;
  hostName?: string;
  price?: number | null;
};

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

function formatDate(date: Date): string {
  const days = ["日", "一", "二", "三", "四", "五", "六"];
  const m = date.getMonth() + 1;
  const d = date.getDate();
  const day = days[date.getDay()];
  const h = date.getHours().toString().padStart(2, "0");
  const min = date.getMinutes().toString().padStart(2, "0");
  return `${m}/${d}(${day}) ${h}:${min}`;
}

function buildBubble(g: SummaryGroup): messagingApi.FlexBubble {
  const remaining = g.maxMembers - g.currentMembers;
  const locationLabel = g.location ? (LOCATION_LABELS[g.location] ?? g.location) : null;

  const tags: messagingApi.FlexComponent[] = [];
  if (locationLabel) {
    tags.push({
      type: "box",
      layout: "vertical",
      backgroundColor: "#EEF7FF",
      cornerRadius: "4px",
      paddingAll: "4px",
      paddingStart: "8px",
      paddingEnd: "8px",
      contents: [{ type: "text", text: locationLabel, size: "xxs", color: "#2563EB" }],
    });
  }
  if (g.price) {
    tags.push({
      type: "box",
      layout: "vertical",
      backgroundColor: "#F0FDF4",
      cornerRadius: "4px",
      paddingAll: "4px",
      paddingStart: "8px",
      paddingEnd: "8px",
      contents: [{ type: "text", text: `$${g.price}`, size: "xxs", color: "#16A34A" }],
    });
  }
  if (g.duration) {
    tags.push({
      type: "box",
      layout: "vertical",
      backgroundColor: "#FEF3C7",
      cornerRadius: "4px",
      paddingAll: "4px",
      paddingStart: "8px",
      paddingEnd: "8px",
      contents: [{ type: "text", text: `${g.duration}分`, size: "xxs", color: "#92400E" }],
    });
  }

  const bodyContents: messagingApi.FlexComponent[] = [
    { type: "text", text: g.roomName, weight: "bold", size: "md", wrap: true },
  ];

  if (g.studio) {
    bodyContents.push({
      type: "text",
      text: g.studio,
      size: "xxs",
      color: "#999999",
      margin: "xs",
    });
  }

  if (tags.length > 0) {
    bodyContents.push({
      type: "box",
      layout: "horizontal",
      spacing: "xs",
      margin: "md",
      contents: tags,
    });
  }

  if (g.datetime) {
    bodyContents.push({
      type: "text",
      text: formatDate(g.datetime),
      size: "xs",
      color: "#666666",
      margin: "md",
    });
  }

  bodyContents.push({ type: "filler" });

  bodyContents.push({
    type: "box",
    layout: "horizontal",
    contents: [
      {
        type: "box",
        layout: "vertical",
        flex: 1,
        contents: [
          {
            type: "text",
            text: `${g.currentMembers}/${g.maxMembers} 人`,
            size: "sm",
            weight: "bold",
            color: "#333333",
          },
          {
            type: "text",
            text: `還差 ${remaining} 人`,
            size: "xxs",
            color: remaining <= 2 ? "#FF3B30" : "#888888",
          },
        ],
      },
      ...(g.hostName
        ? [
            {
              type: "text" as const,
              text: g.hostName,
              size: "xxs" as const,
              color: "#aaaaaa" as const,
              align: "end" as const,
              gravity: "bottom" as const,
            },
          ]
        : []),
    ],
  });

  return {
    type: "bubble",
    size: "kilo",
    body: {
      type: "box",
      layout: "vertical",
      paddingAll: "14px",
      spacing: "none",
      contents: bodyContents,
    },
    footer: {
      type: "box",
      layout: "vertical",
      paddingAll: "10px",
      paddingTop: "0px",
      contents: [
        {
          type: "button",
          style: "primary",
          color: "#06C755",
          height: "sm",
          action: {
            type: "postback",
            label: "我要加入 ✋",
            data: `action=join&groupId=${g.id}`,
            displayText: "我要加入！",
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
        altText: "目前沒有開放的團",
        contents: {
          type: "bubble",
          body: {
            type: "box",
            layout: "vertical",
            paddingAll: "20px",
            spacing: "md",
            contents: [
              {
                type: "text",
                text: "開團彙整",
                weight: "bold",
                size: "lg",
                color: "#333333",
              },
              { type: "separator" },
              {
                type: "text",
                text: "目前沒有開放的團",
                size: "sm",
                color: "#999999",
                margin: "lg",
              },
            ],
          },
        },
      },
    ];
  }

  const titleBubble: messagingApi.FlexBubble = {
    type: "bubble",
    size: "kilo",
    body: {
      type: "box",
      layout: "vertical",
      paddingAll: "20px",
      justifyContent: "center",
      contents: [
        { type: "text", text: "\u{1F4CB}", size: "3xl", align: "center" },
        {
          type: "text",
          text: "開團彙整",
          weight: "bold",
          size: "lg",
          align: "center",
          margin: "md",
        },
        {
          type: "text",
          text: `${groups.length} 團開放中`,
          size: "sm",
          color: "#888888",
          align: "center",
          margin: "sm",
        },
        { type: "separator", margin: "lg" },
        {
          type: "button",
          style: "link",
          height: "sm",
          margin: "md",
          action: {
            type: "uri",
            label: "搜尋更多",
            uri: "https://liff.line.me/2009659299-kwXd0ja5",
          },
        },
      ],
    },
  };

  const messages: messagingApi.FlexMessage[] = [];
  for (let i = 0; i < groups.length; i += 12) {
    const chunk = groups.slice(i, i + 12);
    let bubbles: messagingApi.FlexBubble[];
    if (i === 0) {
      bubbles = [titleBubble, ...chunk.slice(0, 11).map(buildBubble)];
    } else {
      bubbles = chunk.map(buildBubble);
    }
    messages.push({
      type: "flex",
      altText: `開團彙整（${groups.length} 團開放中）`,
      contents: { type: "carousel", contents: bubbles },
    });
  }
  return messages;
}

// Keep the old function for backward compatibility (used by search results in postback handler)
export function buildSummaryCard(groups: SummaryGroup[]): messagingApi.FlexMessage {
  return buildSummaryCards(groups)[0];
}
