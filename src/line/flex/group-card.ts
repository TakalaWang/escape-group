import type { messagingApi } from "@line/bot-sdk";

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

type GroupCardInput = {
  id: string;
  roomName: string;
  studio: string | null;
  location: string | null;
  datetime: Date | null;
  duration: number | null;
  minMembers: number | null;
  maxMembers: number;
  currentMembers: number;
  hostName: string;
  price: number | null;
  note: string | null;
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

  // Info rows
  const infoRows: messagingApi.FlexComponent[] = [];

  if (input.datetime) {
    infoRows.push({
      type: "box",
      layout: "baseline",
      spacing: "sm",
      margin: "md",
      contents: [
        {
          type: "text",
          text: "日期",
          size: "xs",
          color: "#aaaaaa",
          flex: 0,
          weight: "bold",
        },
        {
          type: "text",
          text: formatDate(input.datetime),
          size: "sm",
          color: "#333333",
          flex: 1,
          align: "end",
        },
      ],
    });
  }

  if (input.datetime && input.duration) {
    const endTime = new Date(input.datetime.getTime() + input.duration * 60 * 1000);
    const endH = endTime.getHours().toString().padStart(2, "0");
    const endM = endTime.getMinutes().toString().padStart(2, "0");
    infoRows.push({
      type: "box",
      layout: "baseline",
      spacing: "sm",
      margin: "sm",
      contents: [
        {
          type: "text",
          text: "時長",
          size: "xs",
          color: "#aaaaaa",
          flex: 0,
          weight: "bold",
        },
        {
          type: "text",
          text: `${input.duration}分鐘（~${endH}:${endM}）`,
          size: "sm",
          color: "#333333",
          flex: 1,
          align: "end",
        },
      ],
    });
  } else if (input.duration) {
    infoRows.push({
      type: "box",
      layout: "baseline",
      spacing: "sm",
      margin: "sm",
      contents: [
        {
          type: "text",
          text: "時長",
          size: "xs",
          color: "#aaaaaa",
          flex: 0,
          weight: "bold",
        },
        {
          type: "text",
          text: `${input.duration} 分鐘`,
          size: "sm",
          color: "#333333",
          flex: 1,
          align: "end",
        },
      ],
    });
  }

  if (locationLabel) {
    infoRows.push({
      type: "box",
      layout: "baseline",
      spacing: "sm",
      margin: "sm",
      contents: [
        {
          type: "text",
          text: "地區",
          size: "xs",
          color: "#aaaaaa",
          flex: 0,
          weight: "bold",
        },
        {
          type: "text",
          text: locationLabel,
          size: "sm",
          color: "#333333",
          flex: 1,
          align: "end",
        },
      ],
    });
  }

  if (input.price) {
    infoRows.push({
      type: "box",
      layout: "baseline",
      spacing: "sm",
      margin: "sm",
      contents: [
        {
          type: "text",
          text: "費用",
          size: "xs",
          color: "#aaaaaa",
          flex: 0,
          weight: "bold",
        },
        {
          type: "text",
          text: `$${input.price}/人`,
          size: "sm",
          color: "#333333",
          flex: 1,
          align: "end",
        },
      ],
    });
  }

  infoRows.push({
    type: "box",
    layout: "baseline",
    spacing: "sm",
    margin: "sm",
    contents: [
      {
        type: "text",
        text: "人數",
        size: "xs",
        color: "#aaaaaa",
        flex: 0,
        weight: "bold",
      },
      {
        type: "text",
        text: `${input.currentMembers}/${input.maxMembers}${input.minMembers ? ` (${input.minMembers}人成團)` : ""}`,
        size: "sm",
        color: "#333333",
        flex: 1,
        align: "end",
      },
    ],
  });

  const bubble: messagingApi.FlexBubble = {
    type: "bubble",
    header: {
      type: "box",
      layout: "vertical",
      backgroundColor: "#06C755",
      paddingAll: "16px",
      contents: [
        {
          type: "text",
          text: input.roomName,
          weight: "bold",
          size: "lg",
          color: "#ffffff",
          wrap: true,
        },
        ...(input.studio
          ? [
              {
                type: "text" as const,
                text: input.studio,
                size: "xs" as const,
                color: "#ffffffcc" as const,
                margin: "xs" as const,
              },
            ]
          : []),
      ],
    },
    body: {
      type: "box",
      layout: "vertical",
      spacing: "sm",
      paddingAll: "16px",
      contents: [
        ...infoRows,
        ...(input.note
          ? [
              {
                type: "text" as const,
                text: input.note,
                size: "xs" as const,
                color: "#666666",
                margin: "lg" as const,
                wrap: true,
              },
            ]
          : []),
        { type: "separator", margin: "lg" },
        {
          type: "box",
          layout: "horizontal",
          margin: "md",
          contents: [
            {
              type: "text",
              text: `還差 ${remaining} 人`,
              size: "sm",
              color: remaining <= 2 ? "#FF3B30" : "#06C755",
              weight: "bold",
            },
            {
              type: "text",
              text: `團主：${input.hostName}`,
              size: "xs",
              color: "#aaaaaa",
              align: "end",
            },
          ],
        },
      ],
    },
    footer: {
      type: "box",
      layout: "vertical",
      paddingAll: "12px",
      contents: [
        {
          type: "button",
          style: "primary",
          color: "#06C755",
          height: "sm",
          action: {
            type: "postback",
            label: "加入此團",
            data: `action=join&groupId=${input.id}`,
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
