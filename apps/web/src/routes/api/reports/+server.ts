import { json, error } from "@sveltejs/kit";
import { db } from "$lib/server/db";
import { reports, groupMembers } from "@escape-group/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { updateCreditScore } from "$lib/server/credit";
import type { RequestHandler } from "./$types";

const REPORT_THRESHOLD = 2; // Number of reports needed to trigger credit penalty

// POST /api/reports — report a no-show
export const POST: RequestHandler = async ({ request, locals }) => {
  if (!locals.user) error(401, "Not authenticated");
  if (!locals.user.phone) error(403, "Phone verification required");

  const { reportedUserId, groupId, reason } = await request.json();
  if (!reportedUserId || !groupId) error(400, "reportedUserId and groupId required");
  if (reportedUserId === locals.user.id) error(400, "Cannot report yourself");

  // Verify both users were in the same group
  const [reporterMembership] = await db
    .select()
    .from(groupMembers)
    .where(
      and(
        eq(groupMembers.groupId, groupId),
        eq(groupMembers.userId, locals.user.id)
      )
    );

  if (!reporterMembership) error(403, "You were not in this group");

  // Check for duplicate report
  const [existing] = await db
    .select()
    .from(reports)
    .where(
      and(
        eq(reports.reporterId, locals.user.id),
        eq(reports.reportedUserId, reportedUserId),
        eq(reports.groupId, groupId)
      )
    );

  if (existing) error(400, "Already reported this user for this group");

  // Create report
  const [report] = await db
    .insert(reports)
    .values({
      reporterId: locals.user.id,
      reportedUserId,
      groupId,
      reason: reason ?? null,
    })
    .returning();

  // Check if report threshold reached for this group
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(reports)
    .where(
      and(
        eq(reports.reportedUserId, reportedUserId),
        eq(reports.groupId, groupId)
      )
    );

  if (count >= REPORT_THRESHOLD) {
    await updateCreditScore(reportedUserId, "reported");
  }

  return json(report, { status: 201 });
};
