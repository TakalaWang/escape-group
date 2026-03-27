import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "../src/schema.js";

const DATABASE_URL =
  process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/escape_group";

async function seed() {
  const client = postgres(DATABASE_URL);
  const db = drizzle(client, { schema });

  console.log("Seeding database...");

  // Create demo users
  const [user1] = await db
    .insert(schema.users)
    .values({
      fbId: "demo_user_1",
      phone: "0912345678",
      displayName: "密室王",
      creditScore: 100,
    })
    .returning();

  const [user2] = await db
    .insert(schema.users)
    .values({
      fbId: "demo_user_2",
      phone: "0923456789",
      displayName: "逃脫達人",
      creditScore: 92,
    })
    .returning();

  const [user3] = await db
    .insert(schema.users)
    .values({
      fbId: "demo_user_3",
      phone: "0934567890",
      displayName: "解謎新手",
      creditScore: 78,
    })
    .returning();

  const [user4] = await db
    .insert(schema.users)
    .values({
      fbId: "demo_user_4",
      phone: "0945678901",
      displayName: "鴿子王",
      creditScore: 35,
      isFlagged: true,
    })
    .returning();

  console.log("Created 4 demo users");

  // Create escape rooms
  const [room1] = await db
    .insert(schema.escapeRooms)
    .values({
      name: "末日列車",
      studio: "笨蛋工作室",
      location: "台北市中山區",
      url: "https://example.com/room1",
      minPlayers: 4,
      maxPlayers: 8,
      createdBy: user1.id,
    })
    .returning();

  const [room2] = await db
    .insert(schema.escapeRooms)
    .values({
      name: "深海迷宮",
      studio: "謎途工作室",
      location: "台北市大安區",
      url: "https://example.com/room2",
      minPlayers: 2,
      maxPlayers: 6,
      createdBy: user2.id,
    })
    .returning();

  const [room3] = await db
    .insert(schema.escapeRooms)
    .values({
      name: "時空裂縫",
      studio: "Clue Zone",
      location: "新北市板橋區",
      minPlayers: 4,
      maxPlayers: 10,
      createdBy: user1.id,
    })
    .returning();

  console.log("Created 3 escape rooms");

  // Create groups
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(14, 0, 0, 0);

  const nextWeek = new Date();
  nextWeek.setDate(nextWeek.getDate() + 7);
  nextWeek.setHours(19, 0, 0, 0);

  const [group1] = await db
    .insert(schema.groups)
    .values({
      mode: "host",
      escapeRoomId: room1.id,
      hostId: user1.id,
      datetime: tomorrow,
      maxMembers: 6,
      minCredit: 50,
      autoAccept: true,
      status: "open",
    })
    .returning();

  const [group2] = await db
    .insert(schema.groups)
    .values({
      mode: "host",
      escapeRoomId: room2.id,
      hostId: user2.id,
      datetime: nextWeek,
      maxMembers: 4,
      minCredit: 0,
      autoAccept: false,
      status: "open",
    })
    .returning();

  const [group3] = await db
    .insert(schema.groups)
    .values({
      mode: "gather",
      escapeRoomId: null,
      hostId: user3.id,
      datetime: null,
      timeRangeStart: tomorrow,
      timeRangeEnd: nextWeek,
      maxMembers: 8,
      minCredit: 0,
      autoAccept: true,
      status: "open",
    })
    .returning();

  console.log("Created 3 groups");

  // Add members
  await db.insert(schema.groupMembers).values([
    { groupId: group1.id, userId: user1.id, status: "accepted" },
    { groupId: group1.id, userId: user2.id, status: "accepted" },
    { groupId: group2.id, userId: user2.id, status: "accepted" },
    { groupId: group2.id, userId: user3.id, status: "pending" },
    { groupId: group3.id, userId: user3.id, status: "accepted" },
  ]);

  console.log("Added group members");
  console.log("Seed complete!");

  await client.end();
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
