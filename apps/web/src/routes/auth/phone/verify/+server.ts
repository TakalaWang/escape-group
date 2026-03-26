import { json, error } from "@sveltejs/kit";
import { verifyCode } from "$lib/server/phone";
import { db } from "$lib/server/db";
import { users } from "@escape-group/db/schema";
import { eq } from "drizzle-orm";
import type { RequestHandler } from "./$types";

export const POST: RequestHandler = async ({ request, locals }) => {
  if (!locals.user) error(401, "Not authenticated");

  const { phone, code } = await request.json();
  if (!phone || !code) error(400, "Phone and code required");

  const cleaned = phone.replace(/[\s-]/g, "");
  const result = verifyCode(cleaned, code, locals.user.id);

  if (!result.success) {
    error(400, result.error ?? "Verification failed");
  }

  // Bind phone to user
  await db
    .update(users)
    .set({ phone: cleaned })
    .where(eq(users.id, locals.user.id));

  return json({ success: true });
};
