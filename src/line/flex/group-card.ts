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
  return `${m}/${d}(${day}) ${h}:${min}`;
}

function buildProgressBar(current: number, max: number): messagingApi.FlexComponent {
  const filled = Math.min(current, max);
  const empty = max - filled;
  const boxes: messagingApi.FlexComponent[] = [];

  for (let i = 0; i < filled; i++) {
    boxes.push({
      type: "box",
      layout: "vertical",
      contents: [],
      flex: 1,
      height: "6px",
      backgroundColor: "#06C755",
      cornerRadius: "3px",
    });
  }
  for (let i = 0; i < empty; i++) {
    boxes.push({
      type: "box",
      layout: "vertical",
      contents: [],
      flex: 1,
      height: "6px",
      backgroundColor: "#E8E8E8",
      cornerRadius: "3px",
    });
  }

  return {
    type: "box",
    layout: "horizontal",
    contents: boxes,
    spacing: "xs",
    margin: "lg",
  };
}

function buildInfoLine(parts: string[]): messagingApi.FlexComponent {
  return {
    type: "text",
    text: parts.join(" · "),
    size: "sm",
    color: "#888888",
    wrap: true,
  };
}

export function buildGroupCard(input: GroupCardInput): messagingApi.FlexMessage {
  const remaining = input.maxMembers - input.currentMembers;
  const locationLabel = input.location ? (LOCATION_LABELS[input.location] ?? input.location) : null;

  // Title section
  const titleContents: messagingApi.FlexComponent[] = [
    {
      type: "text",
      text: `🎯 ${input.roomName}`,
      weight: "bold",
      size: "lg",
      wrap: true,
    },
  ];

  if (input.studio) {
    titleContents.push({
      type: "text",
      text: input.studio,
      size: "xs",
      color: "#999999",
      margin: "xs",
    });
  }

  // Info lines
  const infoContents: messagingApi.FlexComponent[] = [];

  if (input.datetime) {
    infoContents.push({
      type: "text",
      text: `📅 ${formatDate(input.datetime)}`,
      size: "sm",
      color: "#888888",
      margin: "lg",
    });
  }

  const detailParts: string[] = [];
  if (locationLabel) detailParts.push(locationLabel);
  if (input.duration) detailParts.push(`${input.duration}分`);
  if (input.price) detailParts.push(`$${input.price}/人`);

  if (detailParts.length > 0) {
    infoContents.push({
      type: "text",
      text: `📍 ${detailParts.join(" · ")}`,
      size: "sm",
      color: "#888888",
      margin: "xs",
    });
  }

  // Note
  if (input.note) {
    infoContents.push({
      type: "text",
      text: input.note,
      size: "xs",
      color: "#aaaaaa",
      margin: "md",
      wrap: true,
    });
  }

  // Progress bar + members
  const membersSection: messagingApi.FlexComponent[] = [
    buildProgressBar(input.currentMembers, input.maxMembers),
    {
      type: "box",
      layout: "horizontal",
      margin: "sm",
      contents: [
        {
          type: "text",
          text: remaining <= 0 ? "已額滿" : `還差 ${remaining} 人`,
          size: "sm",
          color: remaining <= 2 ? "#FF3B30" : "#06C755",
          weight: "bold",
          flex: 1,
        },
        {
          type: "text",
          text: `${input.currentMembers}/${input.maxMembers}人 · ${input.hostName}`,
          size: "xs",
          color: "#aaaaaa",
          align: "end",
          flex: 2,
        },
      ],
    },
  ];

  const bubble: messagingApi.FlexBubble = {
    type: "bubble",
    body: {
      type: "box",
      layout: "vertical",
      paddingAll: "20px",
      contents: [...titleContents, ...infoContents, ...membersSection],
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
            type: "postback",
            label: "我要加入 ✋",
            data: `action=join&groupId=${input.id}`,
            displayText: "我要加入！",
          },
        },
      ],
    },
  };

  return {
    type: "flex",
    altText: `🎯 ${input.roomName}（還差 ${remaining} 人）`,
    contents: bubble,
  };
}

// Card for sharing via shareTargetPicker (uses URI for recipients who may not have bot)
export function buildShareableGroupCard(input: GroupCardInput): messagingApi.FlexMessage {
  const card = buildGroupCard(input);
  const bubble = card.contents as messagingApi.FlexBubble;
  return {
    ...card,
    contents: {
      ...bubble,
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
              type: "uri",
              label: "我要加入 ✋",
              uri: `https://liff.line.me/2009659299-kwXd0ja5?join=${input.id}`,
            },
          },
        ],
      },
    },
  };
}

export { LOCATION_LABELS };
export type { GroupCardInput };
