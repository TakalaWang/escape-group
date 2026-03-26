import { json, error } from "@sveltejs/kit";
import { generateVerificationCode } from "$lib/server/phone";
import type { RequestHandler } from "./$types";

export const POST: RequestHandler = async ({ request, locals }) => {
  if (!locals.user) error(401, "Not authenticated");

  const { phone } = await request.json();
  if (!phone || typeof phone !== "string") error(400, "Phone number required");

  // Basic phone format validation (Taiwan mobile: 09xxxxxxxx)
  const cleaned = phone.replace(/[\s-]/g, "");
  if (!/^09\d{8}$/.test(cleaned)) error(400, "Invalid phone number format");

  generateVerificationCode(locals.user.id, cleaned);

  return json({ success: true });
};
