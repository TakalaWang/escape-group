import type { messagingApi } from "@line/bot-sdk";
import { LOCATION_LABELS, formatDate, buildProgressBar } from "./shared.js";

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
    buildProgressBar(input.currentMembers, input.maxMembers, "lg"),
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
