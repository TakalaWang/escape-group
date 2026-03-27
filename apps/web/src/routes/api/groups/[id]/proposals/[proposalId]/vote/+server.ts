import { json, error } from "@sveltejs/kit";
import { db } from "$lib/server/db";
import { groupMembers, groupProposals, proposalVotes } from "@escape-group/db/schema";
import { eq, and } from "drizzle-orm";
import type { RequestHandler } from "./$types";

// POST /api/groups/:id/proposals/:proposalId/vote — vote for a proposal
export const POST: RequestHandler = async ({ params, locals }) => {
  if (!locals.user) error(401, "Not authenticated");

  // Check user is a member
  const [membership] = await db
    .select()
    .from(groupMembers)
    .where(
      and(
        eq(groupMembers.groupId, params.id),
        eq(groupMembers.userId, locals.user.id),
        eq(groupMembers.status, "accepted")
      )
    );
  if (!membership) error(403, "Not a member");

  // Check proposal exists
  const [proposal] = await db
    .select()
    .from(groupProposals)
    .where(eq(groupProposals.id, params.proposalId));
  if (!proposal) error(404, "Proposal not found");

  // Toggle vote
  const [existingVote] = await db
    .select()
    .from(proposalVotes)
    .where(
      and(eq(proposalVotes.proposalId, params.proposalId), eq(proposalVotes.userId, locals.user.id))
    );

  if (existingVote) {
    await db.delete(proposalVotes).where(eq(proposalVotes.id, existingVote.id));
    return json({ voted: false });
  } else {
    await db.insert(proposalVotes).values({
      proposalId: params.proposalId,
      userId: locals.user.id,
    });
    return json({ voted: true });
  }
};
