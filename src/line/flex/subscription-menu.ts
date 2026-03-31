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

export function buildSubscriptionMenu(): messagingApi.FlexMessage {
  const bubble: messagingApi.FlexBubble = {
    type: "bubble",
    body: {
      type: "box",
      layout: "vertical",
      contents: [
        { type: "text", text: "🔔 訂閱設定", weight: "bold", size: "lg" },
        {
          type: "text",
          text: "有符合條件的新團時會通知你",
          size: "xs",
          color: "#888888",
          margin: "sm",
        },
        { type: "separator", margin: "md" },
      ],
    },
    footer: {
      type: "box",
      layout: "vertical",
      spacing: "sm",
      contents: [
        {
          type: "button",
          style: "primary",
          color: "#06C755",
          action: { type: "postback", label: "訂閱地區", data: "action=sub_location" },
        },
        {
          type: "button",
          style: "secondary",
          action: { type: "postback", label: "訂閱關鍵字", data: "action=sub_keyword" },
        },
        {
          type: "button",
          style: "secondary",
          action: { type: "postback", label: "設定價格上限", data: "action=sub_price" },
        },
        {
          type: "button",
          style: "secondary",
          action: {
            type: "postback",
            label: "查看我的訂閱",
            data: "action=my_subscriptions",
          },
        },
      ],
    },
  };

  return {
    type: "flex",
    altText: "🔔 訂閱設定",
    contents: bubble,
  };
}

type Sub = { id: string; type: string; value: string };

export function buildMySubscriptions(subs: Sub[]): messagingApi.FlexMessage {
  const bodyContents: any[] = [
    { type: "text", text: "🔔 我的訂閱", weight: "bold", size: "lg" },
    { type: "separator", margin: "md" },
  ];

  if (subs.length === 0) {
    bodyContents.push({
      type: "text",
      text: "還沒有訂閱",
      size: "sm",
      color: "#888888",
      margin: "lg",
    });
  }

  for (const s of subs) {
    let label: string;
    if (s.type === "location") label = `📍 ${LOCATION_LABELS[s.value] || s.value}`;
    else if (s.type === "keyword") label = `🔍 ${s.value}`;
    else if (s.type === "price") label = `💰 ${s.value} 元以下`;
    else label = s.value;

    bodyContents.push({
      type: "box",
      layout: "horizontal",
      margin: "md",
      contents: [
        { type: "text", text: label, size: "sm", flex: 3 },
        {
          type: "button",
          style: "secondary",
          height: "sm",
          flex: 1,
          action: {
            type: "postback",
            label: "刪除",
            data: `action=unsub&subId=${s.id}`,
          },
        },
      ],
    });
  }

  const bubble: messagingApi.FlexBubble = {
    type: "bubble",
    body: { type: "box", layout: "vertical", contents: bodyContents },
  };

  return { type: "flex", altText: "我的訂閱", contents: bubble };
}

export function buildLocationPicker(): messagingApi.FlexMessage {
  const regions = [
    {
      label: "北部",
      locations: [
        ["keelung", "基隆"],
        ["taipei", "台北"],
        ["new_taipei", "新北"],
        ["taoyuan", "桃園"],
        ["hsinchu", "新竹"],
        ["miaoli", "苗栗"],
      ],
    },
    {
      label: "中部",
      locations: [
        ["taichung", "台中"],
        ["changhua", "彰化"],
        ["nantou", "南投"],
        ["yunlin", "雲林"],
        ["chiayi", "嘉義"],
      ],
    },
    {
      label: "南部",
      locations: [
        ["tainan", "台南"],
        ["kaohsiung", "高雄"],
        ["pingtung", "屏東"],
      ],
    },
    {
      label: "東部 + 離島",
      locations: [
        ["yilan", "宜蘭"],
        ["hualien", "花蓮"],
        ["taitung", "台東"],
        ["penghu", "澎湖"],
        ["kinmen", "金門"],
        ["matsu", "馬祖"],
      ],
    },
  ];

  const bubbles: messagingApi.FlexBubble[] = regions.map((region) => ({
    type: "bubble",
    size: "kilo",
    body: {
      type: "box",
      layout: "vertical",
      contents: [
        { type: "text", text: region.label, weight: "bold", size: "md" },
        { type: "separator", margin: "sm" },
        ...region.locations.map(([value, label]) => ({
          type: "button" as const,
          style: "secondary" as const,
          height: "sm" as const,
          margin: "sm" as const,
          action: {
            type: "postback" as const,
            label,
            data: `action=subscribe&type=location&value=${value}`,
          },
        })),
      ],
    },
  }));

  return {
    type: "flex",
    altText: "選擇訂閱地區",
    contents: { type: "carousel", contents: bubbles },
  };
}
