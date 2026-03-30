import type { messagingApi } from "@line/bot-sdk";

type SummaryGroup = {
  id: string;
  roomName: string;
  datetime: Date | null;
  maxMembers: number;
  currentMembers: number;
};

type DateGroup = {
  dateLabel: string;
  groups: SummaryGroup[];
};

function formatTime(date: Date): string {
  const h = date.getHours().toString().padStart(2, "0");
  const min = date.getMinutes().toString().padStart(2, "0");
  return `${h}:${min}`;
}

function formatDateLabel(date: Date): string {
  const days = ["日", "一", "二", "三", "四", "五", "六"];
  return `${date.getMonth() + 1}/${date.getDate()} (${days[date.getDay()]})`;
}

export function buildSummaryCard(groups: SummaryGroup[]): messagingApi.FlexMessage {
  const dateGroups: DateGroup[] = [];
  const noDateGroups: SummaryGroup[] = [];

  for (const g of groups) {
    if (!g.datetime) {
      noDateGroups.push(g);
      continue;
    }
    const label = formatDateLabel(g.datetime);
    const existing = dateGroups.find((dg) => dg.dateLabel === label);
    if (existing) {
      existing.groups.push(g);
    } else {
      dateGroups.push({ dateLabel: label, groups: [g] });
    }
  }

  const bodyContents: any[] = [
    {
      type: "text",
      text: "📋 開團彙整",
      weight: "bold",
      size: "lg",
    },
    { type: "separator", margin: "md" },
  ];

  for (const dg of dateGroups) {
    bodyContents.push({
      type: "text",
      text: dg.dateLabel,
      weight: "bold",
      size: "sm",
      margin: "lg",
    });

    for (const g of dg.groups) {
      const time = g.datetime ? formatTime(g.datetime) : "";
      const remaining = g.maxMembers - g.currentMembers;
      bodyContents.push({
        type: "box",
        layout: "horizontal",
        margin: "sm",
        contents: [
          {
            type: "text",
            text: `· ${g.roomName} ${time}`,
            size: "sm",
            flex: 4,
            action: {
              type: "postback",
              label: "查看",
              data: `action=detail&groupId=${g.id}`,
            },
          },
          {
            type: "text",
            text: `${g.currentMembers}/${g.maxMembers}人`,
            size: "sm",
            flex: 1,
            align: "end",
            color: remaining <= 1 ? "#FF0000" : "#888888",
          },
        ],
      });
    }
  }

  if (noDateGroups.length > 0) {
    bodyContents.push({
      type: "text",
      text: "時間未定",
      weight: "bold",
      size: "sm",
      margin: "lg",
    });
    for (const g of noDateGroups) {
      bodyContents.push({
        type: "box",
        layout: "horizontal",
        margin: "sm",
        contents: [
          { type: "text", text: `· ${g.roomName}`, size: "sm", flex: 4 },
          {
            type: "text",
            text: `${g.currentMembers}/${g.maxMembers}人`,
            size: "sm",
            flex: 1,
            align: "end",
            color: "#888888",
          },
        ],
      });
    }
  }

  if (groups.length === 0) {
    bodyContents.push({
      type: "text",
      text: "目前沒有開放的團",
      size: "sm",
      color: "#888888",
      margin: "lg",
    });
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
    altText: `📋 開團彙整（${groups.length} 團開放中）`,
    contents: bubble,
  };
}
