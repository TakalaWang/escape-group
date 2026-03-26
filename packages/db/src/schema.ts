import {
  pgTable,
  text,
  integer,
  boolean,
  timestamp,
  uuid,
  pgEnum,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const groupModeEnum = pgEnum("group_mode", [
  "host",
  "match",
  "gather",
]);
export const groupStatusEnum = pgEnum("group_status", [
  "open",
  "full",
  "confirmed",
  "completed",
  "cancelled",
]);
export const memberStatusEnum = pgEnum("member_status", [
  "pending",
  "accepted",
  "attended",
  "no_show",
  "excused",
]);

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  fbId: text("fb_id").unique().notNull(),
  phone: text("phone").unique(),
  displayName: text("display_name").notNull(),
  avatarUrl: text("avatar_url"),
  creditScore: integer("credit_score").notNull().default(100),
  isFlagged: boolean("is_flagged").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

export const escapeRooms = pgTable("escape_rooms", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  studio: text("studio"),
  url: text("url"),
  location: text("location"),
  minPlayers: integer("min_players"),
  maxPlayers: integer("max_players"),
  createdBy: uuid("created_by").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
}, (table) => [
  index("escape_rooms_location_idx").on(table.location),
]);

export const groups = pgTable("groups", {
  id: uuid("id").primaryKey().defaultRandom(),
  mode: groupModeEnum("mode").notNull(),
  escapeRoomId: uuid("escape_room_id").references(() => escapeRooms.id),
  hostId: uuid("host_id")
    .notNull()
    .references(() => users.id),
  datetime: timestamp("datetime", { withTimezone: true }),
  timeRangeStart: timestamp("time_range_start", { withTimezone: true }),
  timeRangeEnd: timestamp("time_range_end", { withTimezone: true }),
  maxMembers: integer("max_members").notNull(),
  minCredit: integer("min_credit").notNull().default(0),
  autoAccept: boolean("auto_accept").notNull().default(true),
  status: groupStatusEnum("status").notNull().default("open"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
}, (table) => [
  index("groups_status_idx").on(table.status),
  index("groups_host_id_idx").on(table.hostId),
  index("groups_created_at_idx").on(table.createdAt),
]);

export const groupMembers = pgTable("group_members", {
  id: uuid("id").primaryKey().defaultRandom(),
  groupId: uuid("group_id")
    .notNull()
    .references(() => groups.id),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  status: memberStatusEnum("status").notNull().default("pending"),
  joinedAt: timestamp("joined_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
}, (table) => [
  index("group_members_group_id_idx").on(table.groupId),
  index("group_members_user_id_idx").on(table.userId),
  uniqueIndex("group_members_group_user_idx").on(table.groupId, table.userId),
]);

export const reports = pgTable("reports", {
  id: uuid("id").primaryKey().defaultRandom(),
  reporterId: uuid("reporter_id")
    .notNull()
    .references(() => users.id),
  reportedUserId: uuid("reported_user_id")
    .notNull()
    .references(() => users.id),
  groupId: uuid("group_id")
    .notNull()
    .references(() => groups.id),
  reason: text("reason"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
}, (table) => [
  index("reports_reported_user_group_idx").on(table.reportedUserId, table.groupId),
  uniqueIndex("reports_unique_idx").on(table.reporterId, table.reportedUserId, table.groupId),
]);

// Proposals for gather mode — members suggest rooms, others vote
export const groupProposals = pgTable("group_proposals", {
  id: uuid("id").primaryKey().defaultRandom(),
  groupId: uuid("group_id")
    .notNull()
    .references(() => groups.id),
  escapeRoomId: uuid("escape_room_id")
    .notNull()
    .references(() => escapeRooms.id),
  proposedBy: uuid("proposed_by")
    .notNull()
    .references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
}, (table) => [
  index("group_proposals_group_idx").on(table.groupId),
]);

export const proposalVotes = pgTable("proposal_votes", {
  id: uuid("id").primaryKey().defaultRandom(),
  proposalId: uuid("proposal_id")
    .notNull()
    .references(() => groupProposals.id),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
}, (table) => [
  uniqueIndex("proposal_votes_unique_idx").on(table.proposalId, table.userId),
]);

// Match mode queue — users express interest, system auto-groups when threshold met
export const matchStatusEnum = pgEnum("match_status", [
  "waiting",
  "matched",
  "expired",
]);

export const matchRequests = pgTable("match_requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  escapeRoomId: uuid("escape_room_id")
    .notNull()
    .references(() => escapeRooms.id),
  timeRangeStart: timestamp("time_range_start", { withTimezone: true }).notNull(),
  timeRangeEnd: timestamp("time_range_end", { withTimezone: true }).notNull(),
  status: matchStatusEnum("status").notNull().default("waiting"),
  matchedGroupId: uuid("matched_group_id").references(() => groups.id),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
}, (table) => [
  index("match_requests_status_idx").on(table.status),
  index("match_requests_room_idx").on(table.escapeRoomId),
]);
