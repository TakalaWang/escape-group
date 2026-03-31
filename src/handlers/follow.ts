import type { FollowEvent } from "@line/bot-sdk";
import { upsertUser } from "../services/user.js";
import { getLineClient } from "../line/client.js";

export async function handleFollow(event: FollowEvent): Promise<void> {
  const userId = event.source.userId;
  if (!userId) return;

  await upsertUser(userId);

  const client = getLineClient();
  await client.replyMessage({
    replyToken: event.replyToken,
    messages: [
      {
        type: "flex",
        altText: "歡迎使用密室揪團 Bot！",
        contents: {
          type: "bubble",
          header: {
            type: "box",
            layout: "vertical",
            backgroundColor: "#06C755",
            paddingAll: "20px",
            contents: [
              {
                type: "text",
                text: "歡迎使用密室揪團 Bot！",
                weight: "bold",
                size: "lg",
                color: "#ffffff",
              },
              {
                type: "text",
                text: "為你的密室社群打造的揪團工具",
                size: "xs",
                color: "#ffffffcc",
                margin: "sm",
              },
            ],
          },
          body: {
            type: "box",
            layout: "vertical",
            spacing: "lg",
            paddingAll: "20px",
            contents: [
              {
                type: "box",
                layout: "horizontal",
                spacing: "md",
                contents: [
                  { type: "text", text: "\ud83d\udeaa", size: "xl", flex: 0 },
                  {
                    type: "box",
                    layout: "vertical",
                    flex: 1,
                    contents: [
                      { type: "text", text: "開團", weight: "bold", size: "sm" },
                      {
                        type: "text",
                        text: "填表單快速建立密室團",
                        size: "xs",
                        color: "#888888",
                        wrap: true,
                      },
                    ],
                  },
                ],
              },
              {
                type: "box",
                layout: "horizontal",
                spacing: "md",
                contents: [
                  { type: "text", text: "\ud83d\udd0d", size: "xl", flex: 0 },
                  {
                    type: "box",
                    layout: "vertical",
                    flex: 1,
                    contents: [
                      { type: "text", text: "找團", weight: "bold", size: "sm" },
                      {
                        type: "text",
                        text: "依地區、時間、關鍵字搜尋",
                        size: "xs",
                        color: "#888888",
                        wrap: true,
                      },
                    ],
                  },
                ],
              },
              {
                type: "box",
                layout: "horizontal",
                spacing: "md",
                contents: [
                  { type: "text", text: "\ud83d\udccb", size: "xl", flex: 0 },
                  {
                    type: "box",
                    layout: "vertical",
                    flex: 1,
                    contents: [
                      { type: "text", text: "我的團", weight: "bold", size: "sm" },
                      {
                        type: "text",
                        text: "管理開的團和加入的團",
                        size: "xs",
                        color: "#888888",
                        wrap: true,
                      },
                    ],
                  },
                ],
              },
              {
                type: "box",
                layout: "horizontal",
                spacing: "md",
                contents: [
                  { type: "text", text: "\ud83d\udd14", size: "xl", flex: 0 },
                  {
                    type: "box",
                    layout: "vertical",
                    flex: 1,
                    contents: [
                      { type: "text", text: "訂閱", weight: "bold", size: "sm" },
                      {
                        type: "text",
                        text: "訂閱地區/關鍵字，有新團自動通知",
                        size: "xs",
                        color: "#888888",
                        wrap: true,
                      },
                    ],
                  },
                ],
              },
            ],
          },
          footer: {
            type: "box",
            layout: "vertical",
            paddingAll: "16px",
            contents: [
              {
                type: "text",
                text: "點擊下方選單開始使用 \ud83d\udc47",
                size: "sm",
                color: "#999999",
                align: "center",
              },
            ],
          },
        },
      },
    ],
  });
}
