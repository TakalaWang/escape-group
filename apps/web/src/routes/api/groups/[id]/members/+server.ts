import { json, error } from "@sveltejs/kit";
import { db } from "$lib/server/db";
import { groups, groupMembers } from "@escape-group/db/schema";
import { eq, and } from "drizzle-orm";
import type { RequestHandler } from "./$types";

// PATCH /api/groups/:id/members — update member status (host only)
export const PATCH: RequestHandler = async ({ params, request, locals }) => {
  if (!locals.user) error(401, "Not authenticated");

  const [group] = await db
    .select()
    .from(groups)
    .where(eq(groups.id, params.id));

  if (!group) error(404, "Group not found");
  if (group.hostId !== locals.user.id) error(403, "Only host can manage members");

  const { memberId, status } = await request.json();
  if (!memberId || !status) error(400, "memberId and status required");
  if (!["accepted", "pending", "attended", "no_show", "excused"].includes(status)) {
    error(400, "Invalid status");
  }

  const [updated] = await db
    .update(groupMembers)
    .set({ status })
    .where(
      and(
        eq(groupMembers.id, memberId),
        eq(groupMembers.groupId, params.id)
      )
    )
    .returning();

  if (!updated) error(404, "Member not found");

  return json(updated);
};
