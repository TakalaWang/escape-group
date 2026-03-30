function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

export const config = {
  lineChannelSecret: required("LINE_CHANNEL_SECRET"),
  lineChannelAccessToken: required("LINE_CHANNEL_ACCESS_TOKEN"),
  lineGroupId: required("LINE_GROUP_ID"),
  liffId: required("LIFF_ID"),
  adminUserIds: (process.env.ADMIN_USER_IDS ?? "").split(",").filter(Boolean),
  cronSecret: process.env.CRON_SECRET ?? "",
};
