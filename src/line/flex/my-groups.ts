import type { messagingApi } from "@line/bot-sdk";
import { formatDate, STATUS_CONFIG } from "./shared.js";

type MyGroup = {
  id: string;
  roomName: string;
  datetime: Date | null;
  maxMembers: number;
  currentMembers: number;
  status: string;
};

export function buildMyGroupsCard(groups: MyGroup[]): messagingApi.FlexMessage {
  if (groups.length === 0) {
    return {
      type: "flex",
      altText: "我的團",
      contents: {
        type: "bubble",
        body: {
          type: "box",
          layout: "vertical",
          paddingAll: "20px",
          spacing: "md",
          contents: [
            { type: "text", text: "我的團", weight: "bold", size: "lg" },
            { type: "separator" },
            {
              type: "text",
              text: "你還沒有開過團\n點選「開團」來建立第一個團吧！",
              size: "sm",
              color: "#999999",
              margin: "lg",
              wrap: true,
            },
          ],
        },
      },
    };
  }

  // Use carousel - one bubble per group for better readability
  const bubbles: messagingApi.FlexBubble[] = groups.map((g) => {
    const remaining = g.maxMembers - g.currentMembers;
    const status = STATUS_CONFIG[g.status] || STATUS_CONFIG.open;
    const isActive = g.status === "open" || g.status === "full";

    const bodyContents: messagingApi.FlexComponent[] = [
      {
        type: "box",
        layout: "horizontal",
        contents: [
          {
            type: "text",
            text: g.roomName,
            weight: "bold",
            size: "md",
            flex: 3,
            wrap: true,
          },
          {
            type: "box",
            layout: "vertical",
            flex: 0,
            backgroundColor: status.bg,
            cornerRadius: "4px",
            paddingAll: "4px",
            paddingStart: "8px",
            paddingEnd: "8px",
            contents: [
              {
                type: "text",
                text: status.label,
                size: "xxs",
                color: status.color,
                weight: "bold",
              },
            ],
          },
        ],
      },
    ];

    if (g.datetime) {
      bodyContents.push({
        type: "text",
        text: formatDate(g.datetime),
        size: "xs",
        color: "#888888",
        margin: "md",
      });
    }

    bodyContents.push({
      type: "text",
      text: `${g.currentMembers}/${g.maxMembers} 人${g.status === "open" ? ` — 還差 ${remaining} 人` : ""}`,
      size: "sm",
      color: "#555555",
      margin: "sm",
    });

    const footerButtons: messagingApi.FlexComponent[] = [];
    if (g.status === "open") {
      footerButtons.push({
        type: "button",
        style: "secondary",
        height: "sm",
        action: {
          type: "uri",
          label: "編輯",
          uri: `https://liff.line.me/2009659299-rbF8C1zz?edit=${g.id}`,
        },
      });
    }
    if (isActive) {
      footerButtons.push({
        type: "button",
        style: "secondary",
        height: "sm",
        action: {
          type: "postback",
          label: "成員",
          data: `action=manage_members&groupId=${g.id}`,
        },
      });
    }
    if (g.status === "open") {
      footerButtons.push({
        type: "button",
        style: "secondary",
        height: "sm",
        color: "#DC2626",
        action: {
          type: "postback",
          label: "取消",
          data: `action=cancel_group&groupId=${g.id}`,
        },
      });
    }

    return {
      type: "bubble" as const,
      size: "kilo" as const,
      body: {
        type: "box" as const,
        layout: "vertical" as const,
        paddingAll: "14px",
        spacing: "none" as const,
        contents: bodyContents,
      },
      ...(footerButtons.length > 0
        ? {
            footer: {
              type: "box" as const,
              layout: "horizontal" as const,
              spacing: "sm" as const,
              paddingAll: "10px",
              paddingTop: "0px",
              contents: footerButtons,
            },
          }
        : {}),
    };
  });

  return {
    type: "flex",
    altText: `我管理的團（${groups.length} 個）`,
    contents:
      bubbles.length === 1 ? bubbles[0] : { type: "carousel", contents: bubbles.slice(0, 12) },
  };
}

type JoinedGroup = {
  id: string;
  roomName: string;
  datetime: Date | null;
  maxMembers: number;
  currentMembers: number;
  status: string;
  hostName: string;
};

export function buildJoinedGroupsCard(groups: JoinedGroup[]): messagingApi.FlexMessage {
  if (groups.length === 0) {
    return {
      type: "flex",
      altText: "加入的團",
      contents: {
        type: "bubble",
        body: {
          type: "box",
          layout: "vertical",
          paddingAll: "20px",
          spacing: "md",
          contents: [
            { type: "text", text: "加入的團", weight: "bold", size: "lg" },
            { type: "separator" },
            {
              type: "text",
              text: "你還沒有加入任何團\n到「找團」看看有什麼團可以加入！",
              size: "sm",
              color: "#999999",
              margin: "lg",
              wrap: true,
            },
          ],
        },
      },
    };
  }

  const bubbles: messagingApi.FlexBubble[] = groups.map((g) => {
    const status = STATUS_CONFIG[g.status] || STATUS_CONFIG.open;
    const isActive = g.status === "open" || g.status === "full";

    const bodyContents: messagingApi.FlexComponent[] = [
      {
        type: "box",
        layout: "horizontal",
        contents: [
          { type: "text", text: g.roomName, weight: "bold", size: "md", flex: 3, wrap: true },
          {
            type: "box",
            layout: "vertical",
            flex: 0,
            backgroundColor: status.bg,
            cornerRadius: "4px",
            paddingAll: "4px",
            paddingStart: "8px",
            paddingEnd: "8px",
            contents: [
              {
                type: "text",
                text: status.label,
                size: "xxs",
                color: status.color,
                weight: "bold",
              },
            ],
          },
        ],
      },
    ];

    if (g.datetime) {
      bodyContents.push({
        type: "text",
        text: `${formatDate(g.datetime)} · ${g.currentMembers}/${g.maxMembers}人`,
        size: "xs",
        color: "#888888",
        margin: "md",
      });
    }

    bodyContents.push({
      type: "text",
      text: `團主：${g.hostName}`,
      size: "xxs",
      color: "#aaaaaa",
      margin: "sm",
    });

    return {
      type: "bubble" as const,
      size: "kilo" as const,
      body: {
        type: "box" as const,
        layout: "vertical" as const,
        paddingAll: "14px",
        spacing: "none" as const,
        contents: bodyContents,
      },
      ...(isActive
        ? {
            footer: {
              type: "box" as const,
              layout: "vertical" as const,
              paddingAll: "10px",
              paddingTop: "0px",
              contents: [
                {
                  type: "button" as const,
                  style: "secondary" as const,
                  height: "sm" as const,
                  color: "#DC2626",
                  action: {
                    type: "postback" as const,
                    label: "退團",
                    data: `action=leave&groupId=${g.id}`,
                  },
                },
              ],
            },
          }
        : {}),
    };
  });

  return {
    type: "flex",
    altText: `加入的團（${groups.length} 個）`,
    contents:
      bubbles.length === 1 ? bubbles[0] : { type: "carousel", contents: bubbles.slice(0, 12) },
  };
}
