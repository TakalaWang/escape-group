import type { IncomingMessage, ServerResponse } from "node:http";
import { runDailySummary } from "../../src/cron/daily-summary.js";

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const authHeader = req.headers.authorization;
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    res.statusCode = 401;
    res.end(JSON.stringify({ error: "Unauthorized" }));
    return;
  }

  try {
    await runDailySummary();
    res.statusCode = 200;
    res.end(JSON.stringify({ status: "ok" }));
  } catch (err) {
    console.error("Daily summary cron failed:", err);
    res.statusCode = 500;
    res.end(JSON.stringify({ error: "Failed to run daily summary" }));
  }
}
