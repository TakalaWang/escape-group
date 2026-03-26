import {
  pgTable,
  text,
  integer,
  boolean,
  timestamp,
  uuid,
  pgEnum,
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
});

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
});

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
});

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
});
