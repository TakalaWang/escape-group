import { json } from "@sveltejs/kit";
import { db } from "$lib/server/db";
import { sql } from "drizzle-orm";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async () => {
  let dbOk = false;
  try {
    await db.execute(sql`SELECT 1`);
    dbOk = true;
  } catch {
    // DB connection failed
  }

  const status = dbOk ? "healthy" : "degraded";
  const statusCode = dbOk ? 200 : 503;

  return json(
    {
      status,
      db: dbOk ? "connected" : "disconnected",
      timestamp: new Date().toISOString(),
    },
    { status: statusCode }
  );
};
