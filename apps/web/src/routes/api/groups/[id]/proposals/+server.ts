import { json, error } from "@sveltejs/kit";
import { db } from "$lib/server/db";
import {
  groups,
  groupMembers,
  groupProposals,
  escapeRooms,
  proposalVotes,
  users,
} from "@escape-group/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { sanitizeText, sanitizeUrl } from "$lib/server/validation";
import type { RequestHandler } from "./$types";

// GET /api/groups/:id/proposals — list proposals with vote counts
export const GET: RequestHandler = async ({ params }) => {
  const proposals = await db
    .select({
      id: groupProposals.id,
      groupId: groupProposals.groupId,
      proposedBy: groupProposals.proposedBy,
      proposerName: users.displayName,
      createdAt: groupProposals.createdAt,
      roomId: escapeRooms.id,
      roomName: escapeRooms.name,
      roomStudio: escapeRooms.studio,
      roomLocation: escapeRooms.location,
      roomUrl: escapeRooms.url,
      roomMinPlayers: escapeRooms.minPlayers,
      roomMaxPlayers: escapeRooms.maxPlayers,
    })
    .from(groupProposals)
    .innerJoin(escapeRooms, eq(groupProposals.escapeRoomId, escapeRooms.id))
    .innerJoin(users, eq(groupProposals.proposedBy, users.id))
    .where(eq(groupProposals.groupId, params.id));

  // Get vote counts
  const votes = await db
    .select({
      proposalId: proposalVotes.proposalId,
      count: sql<number>`count(*)::int`,
    })
    .from(proposalVotes)
    .where(
      sql`${proposalVotes.proposalId} IN (${sql.join(
        proposals.map((p) => sql`${p.id}`),
        sql`, `
      )})`
    )
    .groupBy(proposalVotes.proposalId);

  const voteMap = new Map(votes.map((v) => [v.proposalId, v.count]));

  // Get who voted for what
  const allVotes = await db
    .select({
      proposalId: proposalVotes.proposalId,
      userId: proposalVotes.userId,
    })
    .from(proposalVotes)
    .where(
      sql`${proposalVotes.proposalId} IN (${sql.join(
        proposals.map((p) => sql`${p.id}`),
        sql`, `
      )})`
    );

  const voterMap = new Map<string, string[]>();
  for (const v of allVotes) {
    const arr = voterMap.get(v.proposalId) ?? [];
    arr.push(v.userId);
    voterMap.set(v.proposalId, arr);
  }

  return json(
    proposals.map((p) => ({
      ...p,
      createdAt: p.createdAt.toISOString(),
      voteCount: voteMap.get(p.id) ?? 0,
      voters: voterMap.get(p.id) ?? [],
    }))
  );
};

// POST /api/groups/:id/proposals — add a new room proposal
export const POST: RequestHandler = async ({ params, request, locals }) => {
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
  if (!membership) error(403, "Not a member of this group");

  // Check group is gather mode
  const [group] = await db.select().from(groups).where(eq(groups.id, params.id));
  if (!group) error(404, "Group not found");
  if (group.mode !== "gather") error(400, "Proposals only for gather mode");

  const body = await request.json();
  const cleanName = sanitizeText(body.roomName, 200);
  if (!cleanName) error(400, "Room name required");

  // Create escape room
  const [room] = await db
    .insert(escapeRooms)
    .values({
      name: cleanName,
      studio: sanitizeText(body.roomStudio, 200),
      url: sanitizeUrl(body.roomUrl),
      location: sanitizeText(body.roomLocation, 200),
      minPlayers: body.minPlayers ?? null,
      maxPlayers: body.maxPlayers ?? null,
      createdBy: locals.user.id,
    })
    .returning();

  // Create proposal
  const [proposal] = await db
    .insert(groupProposals)
    .values({
      groupId: params.id,
      escapeRoomId: room.id,
      proposedBy: locals.user.id,
    })
    .returning();

  // Auto-vote for your own proposal
  await db.insert(proposalVotes).values({
    proposalId: proposal.id,
    userId: locals.user.id,
  });

  return json(proposal, { status: 201 });
};
