import type { messagingApi } from "@line/bot-sdk";

export const LOCATION_LABELS: Record<string, string> = {
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

export const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  open: { label: "募集中", color: "#16A34A", bg: "#F0FDF4" },
  full: { label: "已額滿", color: "#2563EB", bg: "#EFF6FF" },
  completed: { label: "已完成", color: "#6B7280", bg: "#F3F4F6" },
  cancelled: { label: "已取消", color: "#DC2626", bg: "#FEF2F2" },
};

export function formatDate(date: Date): string {
  const days = ["日", "一", "二", "三", "四", "五", "六"];
  const m = date.getMonth() + 1;
  const d = date.getDate();
  const day = days[date.getDay()];
  const h = date.getHours().toString().padStart(2, "0");
  const min = date.getMinutes().toString().padStart(2, "0");
  return `${m}/${d}(${day}) ${h}:${min}`;
}

export function buildProgressBar(
  current: number,
  max: number,
  margin?: string
): messagingApi.FlexComponent {
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
    ...(margin ? { margin } : {}),
  };
}
