import { runDailySummary } from "../../src/cron/daily-summary.js";

export default async function handler(req: Request): Promise<Response> {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const lineGroupId = process.env.LINE_GROUP_ID;
  if (!lineGroupId) {
    return Response.json({ error: "LINE_GROUP_ID not configured" }, { status: 500 });
  }

  try {
    await runDailySummary(lineGroupId);
    return Response.json({ status: "ok" });
  } catch (err) {
    console.error("Daily summary cron failed:", err);
    return Response.json({ error: "Failed to run daily summary" }, { status: 500 });
  }
}
