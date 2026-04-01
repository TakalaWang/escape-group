import { db } from "../db/client.js";
import { groups, users } from "../db/schema.js";
import { eq, and, gte, lte, ilike, or, sql, asc } from "drizzle-orm";

type SearchFilters = {
  location?: string;
  dateFrom?: Date;
  dateTo?: Date;
  keyword?: string;
};

export function buildSearchQuery(params: Record<string, string | undefined>): SearchFilters {
  const filters: SearchFilters = {};
  if (params.location) filters.location = params.location;
  if (params.dateFrom) filters.dateFrom = new Date(params.dateFrom);
  if (params.dateTo) filters.dateTo = new Date(params.dateTo);
  if (params.keyword) filters.keyword = params.keyword;
  return filters;
}

export async function searchGroups(filters: SearchFilters) {
  const conditions = [eq(groups.status, "open")];

  if (filters.location) {
    conditions.push(eq(groups.location, filters.location as any));
  }
  if (filters.dateFrom) {
    conditions.push(gte(groups.datetime, filters.dateFrom));
  }
  if (filters.dateTo) {
    conditions.push(lte(groups.datetime, filters.dateTo));
  }
  if (filters.keyword) {
    conditions.push(
      or(
        ilike(groups.roomName, `%${filters.keyword}%`),
        ilike(groups.studio, `%${filters.keyword}%`)
      )!
    );
  }

  const results = await db
    .select({
      id: groups.id,
      roomName: groups.roomName,
      studio: groups.studio,
      location: groups.location,
      datetime: groups.datetime,
      duration: groups.duration,
      maxMembers: groups.maxMembers,
      prefilledMembers: groups.prefilledMembers,
      status: groups.status,
      hostId: groups.hostId,
      createdAt: groups.createdAt,
      hostName: users.displayName,
      memberCount: sql<number>`(
        SELECT count(*)::int FROM group_members
        WHERE group_members.group_id = groups.id
      )`,
    })
    .from(groups)
    .innerJoin(users, eq(groups.hostId, users.id))
    .where(and(...conditions))
    .orderBy(asc(groups.datetime), asc(groups.createdAt));

  return results.map((r) => ({
    ...r,
    currentMembers: r.prefilledMembers + (r.memberCount ?? 0),
  }));
}
