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
  return `${m}/${d}(${day}) ${h}:${min}`;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  open: { label: "募集中", color: "#16A34A", bg: "#F0FDF4" },
  full: { label: "已額滿", color: "#2563EB", bg: "#EFF6FF" },
  completed: { label: "已完成", color: "#6B7280", bg: "#F3F4F6" },
  cancelled: { label: "已取消", color: "#DC2626", bg: "#FEF2F2" },
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
    if (isActive) {
      footerButtons.push({
        type: "button",
        style: "secondary",
        height: "sm",
        action: {
          type: "postback",
          label: "管理成員",
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
          label: "取消團",
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
    altText: `我的團（${groups.length} 個）`,
    contents:
      bubbles.length === 1 ? bubbles[0] : { type: "carousel", contents: bubbles.slice(0, 12) },
  };
}
