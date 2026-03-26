import { db } from "$lib/server/db";
import { groupMembers, groups, matchRequests } from "@escape-group/db/schema";
import { eq, and, sql, inArray } from "drizzle-orm";
import type { LayoutServerLoad } from "./$types";

export const load: LayoutServerLoad = async ({ locals }) => {
  if (!locals.user) {
    return { user: null, notifications: { pendingApprovals: 0, matchedGroups: 0 } };
  }

  const userId = locals.user.id;

  // Count pending member approvals (for groups the user hosts)
  const [pendingResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(groupMembers)
    .innerJoin(groups, eq(groupMembers.groupId, groups.id))
    .where(
      and(
        eq(groups.hostId, userId),
        eq(groupMembers.status, "pending")
      )
    );

  // Count newly matched groups (match requests that got matched)
  const [matchedResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(matchRequests)
    .where(
      and(
        eq(matchRequests.userId, userId),
        eq(matchRequests.status, "matched")
      )
    );

  return {
    user: {
      id: locals.user.id,
      displayName: locals.user.displayName,
      avatarUrl: locals.user.avatarUrl,
      creditScore: locals.user.creditScore,
      phone: locals.user.phone,
      isFlagged: locals.user.isFlagged,
    },
    notifications: {
      pendingApprovals: pendingResult?.count ?? 0,
      matchedGroups: matchedResult?.count ?? 0,
    },
  };
};
