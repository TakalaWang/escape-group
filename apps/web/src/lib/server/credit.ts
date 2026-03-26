import { db } from "./db.js";
import { users } from "@escape-group/db/schema";
import { eq, sql } from "drizzle-orm";

const CREDIT_ATTEND = 2;
const CREDIT_NO_SHOW = -20;
const CREDIT_REPORTED = -10;
const FLAG_THRESHOLD = 40;

export function getCreditChange(action: "attend" | "no_show" | "reported"): number {
  switch (action) {
    case "attend":
      return CREDIT_ATTEND;
    case "no_show":
      return CREDIT_NO_SHOW;
    case "reported":
      return CREDIT_REPORTED;
  }
}

export async function updateCreditScore(userId: string, action: "attend" | "no_show" | "reported") {
  const change = getCreditChange(action);

  const [updated] = await db
    .update(users)
    .set({
      creditScore: sql`GREATEST(0, ${users.creditScore} + ${change})`,
      isFlagged: sql`(${users.creditScore} + ${change}) < ${FLAG_THRESHOLD}`,
    })
    .where(eq(users.id, userId))
    .returning({ creditScore: users.creditScore, isFlagged: users.isFlagged });

  return updated;
}
