import { json, error } from "@sveltejs/kit";
import { db } from "$lib/server/db";
import { groups, groupMembers } from "@escape-group/db/schema";
import { eq, and, sql } from "drizzle-orm";
import type { RequestHandler } from "./$types";

// POST /api/groups/:id/join — join a group
export const POST: RequestHandler = async ({ params, locals }) => {
  if (!locals.user) error(401, "Not authenticated");
  if (!locals.user.phone) error(403, "Phone verification required");

  const [group] = await db
    .select()
    .from(groups)
    .where(eq(groups.id, params.id));

  if (!group) error(404, "Group not found");
  if (group.status !== "open") error(400, "Group is not open");

  // Check credit score requirement
  if (locals.user.creditScore < group.minCredit) {
    error(403, `Minimum credit score required: ${group.minCredit}`);
  }

  // Check not already a member
  const [existing] = await db
    .select()
    .from(groupMembers)
    .where(
      and(
        eq(groupMembers.groupId, params.id),
        eq(groupMembers.userId, locals.user.id)
      )
    );

  if (existing) error(400, "Already a member");

  // Check if group is full
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(groupMembers)
    .where(
      and(
        eq(groupMembers.groupId, params.id),
        eq(groupMembers.status, "accepted")
      )
    );

  if (count >= group.maxMembers) {
    // Auto-update status to full
    await db.update(groups).set({ status: "full" }).where(eq(groups.id, params.id));
    error(400, "Group is full");
  }

  const status = group.autoAccept ? "accepted" : "pending";

  const [member] = await db
    .insert(groupMembers)
    .values({
      groupId: params.id,
      userId: locals.user.id,
      status,
    })
    .returning();

  // Check if group is now full after adding
  if (status === "accepted" && count + 1 >= group.maxMembers) {
    await db.update(groups).set({ status: "full" }).where(eq(groups.id, params.id));
  }

  return json(member, { status: 201 });
};
