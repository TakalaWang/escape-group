import { json, error } from "@sveltejs/kit";
import { db } from "$lib/server/db";
import { groups, groupMembers } from "@escape-group/db/schema";
import { eq, and } from "drizzle-orm";
import { updateCreditScore } from "$lib/server/credit";
import type { RequestHandler } from "./$types";

// POST /api/groups/:id/attendance — host confirms attendance for all members
export const POST: RequestHandler = async ({ params, request, locals }) => {
  if (!locals.user) error(401, "Not authenticated");

  const [group] = await db.select().from(groups).where(eq(groups.id, params.id));

  if (!group) error(404, "Group not found");
  if (group.hostId !== locals.user.id) error(403, "Only host can confirm attendance");
  if (group.status === "completed") error(400, "Attendance already confirmed");

  const { attendance } = await request.json();
  // attendance: Array<{ memberId: string, status: "attended" | "no_show" | "excused" }>
  if (!Array.isArray(attendance)) error(400, "attendance array required");

  const results = [];
  for (const entry of attendance) {
    const { memberId, status } = entry;
    if (!["attended", "no_show", "excused"].includes(status)) continue;

    // Update member status
    const [member] = await db
      .update(groupMembers)
      .set({ status })
      .where(and(eq(groupMembers.id, memberId), eq(groupMembers.groupId, params.id)))
      .returning();

    if (!member) continue;

    // Update credit score
    if (status === "attended") {
      await updateCreditScore(member.userId, "attend");
    } else if (status === "no_show") {
      await updateCreditScore(member.userId, "no_show");
    }
    // "excused" doesn't affect credit

    results.push({ memberId, status });
  }

  // Mark group as completed
  await db.update(groups).set({ status: "completed" }).where(eq(groups.id, params.id));

  return json({ results });
};
