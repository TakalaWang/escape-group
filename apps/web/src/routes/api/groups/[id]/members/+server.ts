import { json, error } from "@sveltejs/kit";
import { db } from "$lib/server/db";
import { groups, groupMembers } from "@escape-group/db/schema";
import { eq, and } from "drizzle-orm";
import type { RequestHandler } from "./$types";

// PATCH /api/groups/:id/members — update member status (host only)
export const PATCH: RequestHandler = async ({ params, request, locals }) => {
  if (!locals.user) error(401, "Not authenticated");

  const [group] = await db.select().from(groups).where(eq(groups.id, params.id));

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
    .where(and(eq(groupMembers.id, memberId), eq(groupMembers.groupId, params.id)))
    .returning();

  if (!updated) error(404, "Member not found");

  return json(updated);
};

// DELETE /api/groups/:id/members — leave group (self) or remove member (host)
export const DELETE: RequestHandler = async ({ params, request, locals }) => {
  if (!locals.user) error(401, "Not authenticated");

  const { memberId } = await request.json();
  if (!memberId) error(400, "memberId required");

  const [group] = await db.select().from(groups).where(eq(groups.id, params.id));

  if (!group) error(404, "Group not found");

  // Find the membership
  const [membership] = await db
    .select()
    .from(groupMembers)
    .where(and(eq(groupMembers.id, memberId), eq(groupMembers.groupId, params.id)));

  if (!membership) error(404, "Member not found");

  // Only allow: self-leave or host-remove
  const isSelf = membership.userId === locals.user.id;
  const isGroupHost = group.hostId === locals.user.id;
  if (!isSelf && !isGroupHost) error(403, "Not authorized");

  // Host cannot leave their own group
  if (isSelf && isGroupHost) error(400, "Host cannot leave. Cancel the group instead.");

  await db.delete(groupMembers).where(eq(groupMembers.id, memberId));

  // Reopen group if it was full
  if (group.status === "full") {
    await db.update(groups).set({ status: "open" }).where(eq(groups.id, params.id));
  }

  return json({ success: true });
};
