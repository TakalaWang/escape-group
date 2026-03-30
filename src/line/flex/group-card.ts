import type { messagingApi } from "@line/bot-sdk";

const LOCATION_LABELS: Record<string, string> = {
  taipei: "台北",
  new_taipei: "新北",
  taoyuan: "桃園",
  hsinchu: "新竹",
  taichung: "台中",
  tainan: "台南",
  kaohsiung: "高雄",
  yilan: "宜蘭",
  hualien: "花蓮",
};

type GroupCardInput = {
  id: string;
  roomName: string;
  studio: string | null;
  location: string | null;
  datetime: Date | null;
  maxMembers: number;
  currentMembers: number;
  hostName: string;
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

export function buildGroupCard(input: GroupCardInput): messagingApi.FlexMessage {
  const remaining = input.maxMembers - input.currentMembers;
  const locationLabel = input.location ? (LOCATION_LABELS[input.location] ?? input.location) : null;
  const subtitle = [input.studio, locationLabel].filter(Boolean).join(" · ");

  const bodyContents: any[] = [
    {
      type: "text",
      text: input.roomName,
      weight: "bold",
      size: "xl",
      wrap: true,
    },
  ];

  if (subtitle) {
    bodyContents.push({
      type: "text",
      text: subtitle,
      size: "sm",
      color: "#888888",
      margin: "sm",
    });
  }

  if (input.datetime) {
    bodyContents.push({
      type: "box",
      layout: "horizontal",
      margin: "lg",
      contents: [
        { type: "text", text: "📅", size: "sm", flex: 0 },
        { type: "text", text: formatDate(input.datetime), size: "sm", margin: "sm" },
      ],
    });
  }

  bodyContents.push(
    {
      type: "box",
      layout: "horizontal",
      margin: "md",
      contents: [
        { type: "text", text: "👥", size: "sm", flex: 0 },
        {
          type: "text",
          text: `${input.currentMembers}/${input.maxMembers} 人（還差 ${remaining} 人）`,
          size: "sm",
          margin: "sm",
        },
      ],
    },
    {
      type: "text",
      text: `團主：${input.hostName}`,
      size: "xs",
      color: "#aaaaaa",
      margin: "lg",
    }
  );

  const bubble: messagingApi.FlexBubble = {
    type: "bubble",
    body: {
      type: "box",
      layout: "vertical",
      contents: bodyContents,
    },
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
            data: `action=join&groupId=${input.id}`,
            displayText: "我要加入！",
          },
        },
      ],
    },
  };

  return {
    type: "flex",
    altText: `開團：${input.roomName}（還差 ${remaining} 人）`,
    contents: bubble,
  };
}
