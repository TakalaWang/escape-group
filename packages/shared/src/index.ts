export const GROUP_MODES = ["host", "match", "gather"] as const;
export type GroupMode = (typeof GROUP_MODES)[number];

export const GROUP_STATUSES = ["open", "full", "confirmed", "completed", "cancelled"] as const;
export type GroupStatus = (typeof GROUP_STATUSES)[number];

export const MEMBER_STATUSES = ["pending", "accepted", "attended", "no_show", "excused"] as const;
export type MemberStatus = (typeof MEMBER_STATUSES)[number];

export const MODE_LABELS: Record<GroupMode, string> = {
  host: "團主制",
  match: "配對制",
  gather: "湊人制",
};

export const STATUS_LABELS: Record<GroupStatus, string> = {
  open: "招募中",
  full: "已額滿",
  confirmed: "已確認",
  completed: "已結束",
  cancelled: "已取消",
};

export const MEMBER_STATUS_LABELS: Record<MemberStatus, string> = {
  pending: "待審核",
  accepted: "已加入",
  attended: "已出席",
  no_show: "跳車",
  excused: "請假",
};

export const CREDIT = {
  INITIAL: 100,
  ATTEND: 2,
  NO_SHOW: -20,
  REPORTED: -10,
  FLAG_THRESHOLD: 40,
  REPORT_THRESHOLD: 2,
} as const;
