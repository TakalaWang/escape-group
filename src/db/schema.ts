import {
  pgTable,
  text,
  integer,
  timestamp,
  uuid,
  pgEnum,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

export const locationEnum = pgEnum("location", [
  "keelung",
  "taipei",
  "new_taipei",
  "taoyuan",
  "hsinchu",
  "miaoli",
  "taichung",
  "changhua",
  "nantou",
  "yunlin",
  "chiayi",
  "tainan",
  "kaohsiung",
  "pingtung",
  "yilan",
  "hualien",
  "taitung",
  "penghu",
  "kinmen",
  "matsu",
]);

export const groupStatusEnum = pgEnum("group_status", ["open", "full", "completed", "cancelled"]);

export const memberStatusEnum = pgEnum("member_status", ["accepted", "attended", "no_show"]);

export const subscriptionTypeEnum = pgEnum("subscription_type", [
  "location",
  "keyword",
  "price",
  "weekday",
]);

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  lineUserId: text("line_user_id").notNull().unique(),
  displayName: text("display_name").notNull(),
  pictureUrl: text("picture_url"),
  attendCount: integer("attend_count").notNull().default(0),
  noShowCount: integer("no_show_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const groups = pgTable(
  "groups",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    hostId: uuid("host_id")
      .notNull()
      .references(() => users.id),
    roomName: text("room_name").notNull(),
    studio: text("studio"),
    location: locationEnum("location"),
    datetime: timestamp("datetime", { withTimezone: true }),
    duration: integer("duration"), // 遊戲時長（分鐘）
    minMembers: integer("min_members"), // 最少成團人數
    maxMembers: integer("max_members").notNull(),
    prefilledMembers: integer("prefilled_members").notNull().default(1),
    price: integer("price"), // 每人費用
    note: text("note"), // 備註
    status: groupStatusEnum("status").notNull().default("open"),
    lineGroupId: text("line_group_id"),
    lastAnnouncedAt: timestamp("last_announced_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("groups_status_idx").on(table.status),
    index("groups_datetime_idx").on(table.datetime),
  ]
);

export const groupMembers = pgTable(
  "group_members",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    status: memberStatusEnum("status").notNull().default("accepted"),
    joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("group_user_unique").on(table.groupId, table.userId)]
);

export const pendingActions = pgTable("pending_actions", {
  id: uuid("id").defaultRandom().primaryKey(),
  lineUserId: text("line_user_id").notNull().unique(),
  action: text("action").notNull(), // "search_keyword" | "sub_keyword" | "sub_price"
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const subscriptions = pgTable(
  "subscriptions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    type: subscriptionTypeEnum("type").notNull(),
    value: text("value").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("subscriptions_user_id_idx").on(table.userId)]
);
