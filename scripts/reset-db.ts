import { db } from "../src/db/client.js";
import { groupMembers, groups, subscriptions, users } from "../src/db/schema.js";

async function main() {
  await db.delete(groupMembers);
  await db.delete(subscriptions);
  await db.delete(groups);
  await db.delete(users);
  console.log("Database cleared.");
  process.exit(0);
}

main().catch(console.error);
