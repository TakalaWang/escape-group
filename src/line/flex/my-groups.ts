import type { messagingApi } from "@line/bot-sdk";

type MyGroup = {
  id: string;
  roomName: string;
  datetime: Date | null;
  maxMembers: number;
  currentMembers: number;
  status: string;
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

export function buildMyGroupsCard(groups: MyGroup[]): messagingApi.FlexMessage {
  const bodyContents: any[] = [
    { type: "text", text: "📋 我的團", weight: "bold", size: "lg" },
    { type: "separator", margin: "md" },
  ];

  if (groups.length === 0) {
    bodyContents.push({
      type: "text",
      text: "你還沒有開過團",
      size: "sm",
      color: "#888888",
      margin: "lg",
    });
  }

  for (const g of groups) {
    const statusLabel =
      g.status === "open"
        ? `${g.currentMembers}/${g.maxMembers}人`
        : g.status === "full"
          ? "已額滿"
          : g.status === "cancelled"
            ? "已取消"
            : "已完成";

    const contents: any[] = [
      {
        type: "text",
        text: g.roomName,
        weight: "bold",
        size: "sm",
        flex: 3,
      },
      {
        type: "text",
        text: statusLabel,
        size: "xs",
        align: "end",
        flex: 1,
        color: g.status === "open" ? "#06C755" : "#888888",
      },
    ];

    bodyContents.push({
      type: "box",
      layout: "horizontal",
      margin: "lg",
      contents,
    });

    if (g.datetime) {
      bodyContents.push({
        type: "text",
        text: formatDate(g.datetime),
        size: "xs",
        color: "#888888",
        margin: "sm",
      });
    }

    if (g.status === "open") {
      bodyContents.push({
        type: "box",
        layout: "horizontal",
        margin: "sm",
        spacing: "sm",
        contents: [
          {
            type: "button",
            style: "secondary",
            height: "sm",
            action: {
              type: "postback",
              label: "取消團",
              data: `action=cancel_group&groupId=${g.id}`,
            },
          },
        ],
      });
    }
  }

  const bubble: messagingApi.FlexBubble = {
    type: "bubble",
    body: {
      type: "box",
      layout: "vertical",
      contents: bodyContents,
    },
  };

  return {
    type: "flex",
    altText: `📋 我的團（${groups.length} 個）`,
    contents: bubble,
  };
}
