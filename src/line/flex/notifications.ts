import type { messagingApi } from "@line/bot-sdk";
import { buildProgressBar } from "./shared.js";

export function buildJoinNotification(
  memberName: string,
  groupName: string,
  current: number,
  max: number
): messagingApi.FlexMessage {
  return {
    type: "flex",
    altText: `👤 ${memberName} 加入了「${groupName}」`,
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
            text: `👤 ${memberName} 加入了`,
            size: "sm",
            weight: "bold",
          },
          {
            type: "text",
            text: `「${groupName}」${current}/${max} 人`,
            size: "sm",
            color: "#888888",
            margin: "xs",
          },
          {
            type: "box",
            layout: "horizontal",
            contents: (buildProgressBar(current, max) as any).contents,
            spacing: "xs",
            margin: "md",
          } as any,
        ],
      },
    },
  };
}

export function buildGroupFullNotification(
  groupName: string,
  max: number,
  dateStr: string
): messagingApi.FlexMessage {
  return {
    type: "flex",
    altText: `🎉「${groupName}」成團！`,
    contents: {
      type: "bubble",
      body: {
        type: "box",
        layout: "vertical",
        paddingAll: "20px",
        contents: [
          { type: "text", text: `🎉 「${groupName}」成團！`, weight: "bold", size: "lg" },
          {
            type: "text",
            text: `${max}/${max} 人 · ${dateStr}`,
            size: "sm",
            color: "#888888",
            margin: "sm",
          },
          {
            type: "box",
            layout: "horizontal",
            contents: (buildProgressBar(max, max) as any).contents,
            spacing: "xs",
            margin: "md",
          } as any,
          {
            type: "text",
            text: "請建立 LINE 群組，然後把邀請連結貼回來給我。",
            size: "sm",
            color: "#666666",
            margin: "lg",
            wrap: true,
          },
        ],
      },
    },
  };
}

export function buildLeaveRequestNotification(
  memberName: string,
  groupName: string,
  groupId: string,
  memberDbId: string,
  memberLineUserId: string
): messagingApi.FlexMessage {
  return {
    type: "flex",
    altText: `${memberName} 想退出「${groupName}」`,
    contents: {
      type: "bubble",
      size: "kilo",
      body: {
        type: "box",
        layout: "vertical",
        paddingAll: "16px",
        contents: [
          { type: "text", text: `${memberName} 想退出`, size: "sm", weight: "bold" },
          { type: "text", text: `「${groupName}」`, size: "sm", color: "#888888", margin: "xs" },
        ],
      },
      footer: {
        type: "box",
        layout: "horizontal",
        spacing: "sm",
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
              label: "同意 ✓",
              data: `action=approve_leave&groupId=${groupId}&userId=${memberDbId}`,
            },
          },
          {
            type: "button",
            style: "secondary",
            height: "sm",
            action: {
              type: "postback",
              label: "拒絕 ✗",
              data: `action=reject_leave&groupId=${groupId}&memberId=${memberLineUserId}`,
            },
          },
        ],
      },
    },
  };
}
