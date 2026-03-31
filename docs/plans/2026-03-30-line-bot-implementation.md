# LINE Bot Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a LINE Bot that serves as a private group-formation tool for a 100+ person escape room LINE community, implementing P0 features (create group, browse/search, join) and essential P1 (daily summary cron).

**Architecture:** Hono web framework deployed as Vercel serverless functions. LINE Messaging API for bot interactions, LIFF for the group creation form. Drizzle ORM with Neon PostgreSQL for data persistence. Single flat project structure (no monorepo).

**Tech Stack:** Hono, TypeScript, Drizzle ORM, Neon PostgreSQL, @line/bot-sdk, @line/liff (CDN), Vitest, Vercel

---

## Task 0: Prerequisites (Manual — User Action Required)

Before coding, set up external services:

**Step 1: Create Neon database**

Go to https://neon.tech → Create project → Copy connection string.

**Step 2: Create LINE Messaging API channel**

1. Go to https://developers.line.biz/console/
2. Create a new provider (or use existing)
3. Create a **Messaging API** channel
4. Note down:
   - **Channel Secret** (Basic settings tab)
   - **Channel Access Token** (Messaging API tab → Issue)
5. Under Messaging API tab:
   - Set **Webhook URL** to `https://<your-vercel-domain>/api/webhook` (set after first deploy)
   - Enable **Use webhook**
   - Disable **Auto-reply messages**
   - Disable **Greeting messages**

**Step 3: Create LIFF app**

1. In the same channel → LIFF tab → Add
2. Size: **Tall**
3. Endpoint URL: `https://<your-vercel-domain>/liff/create-group/` (set after first deploy)
4. Note down the **LIFF ID**

**Step 4: Get the big group's Group ID**

Add the Bot to the big LINE group. The Bot will receive a `join` event with the group ID. We'll capture this during development. For now, leave `LINE_GROUP_ID` empty.

---

## Task 1: Project Scaffold

Remove old SvelteKit monorepo code and set up new flat project structure.

**Files:**

- Delete: `apps/`, `packages/`, `docker-compose.yml`, `pnpm-workspace.yaml`, `.prettierignore`
- Create: `package.json`, `tsconfig.json`, `vercel.json`, `.env.example`
- Modify: `.gitignore`, `.prettierrc`

**Step 1: Remove old project files**

```bash
rm -rf apps/ packages/ docker-compose.yml pnpm-workspace.yaml .prettierignore pnpm-lock.yaml
```

**Step 2: Create `package.json`**

```json
{
  "name": "escape-group-bot",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "db:push": "drizzle-kit push",
    "test": "vitest run",
    "test:watch": "vitest",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "check": "tsc --noEmit"
  },
  "dependencies": {
    "@line/bot-sdk": "^9.7.0",
    "drizzle-orm": "^0.45.1",
    "hono": "^4.7.6",
    "postgres": "^3.4.8"
  },
  "devDependencies": {
    "@hono/node-server": "^1.14.1",
    "@types/node": "^22.15.3",
    "drizzle-kit": "^0.31.10",
    "prettier": "^3.8.1",
    "tsx": "^4.21.0",
    "typescript": "^5.9.3",
    "vitest": "^4.1.2"
  }
}
```

**Step 3: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "./dist",
    "rootDir": ".",
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src", "api"],
  "exclude": ["node_modules", "dist"]
}
```

**Step 4: Create `.env.example`**

```
DATABASE_URL=postgresql://user:pass@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require
LINE_CHANNEL_SECRET=your_channel_secret
LINE_CHANNEL_ACCESS_TOKEN=your_channel_access_token
LINE_GROUP_ID=your_big_group_id
LIFF_ID=your_liff_id
ADMIN_USER_IDS=Uxxxxx,Uyyyyy
CRON_SECRET=your_random_secret_for_cron
```

**Step 5: Create `vercel.json`**

```json
{
  "rewrites": [{ "source": "/api/(.*)", "destination": "/api/[[...route]]" }],
  "crons": [{ "path": "/api/cron/daily-summary", "schedule": "0 12 * * *" }]
}
```

Note: `0 12 * * *` = 12:00 UTC = 20:00 台灣時間 (UTC+8).

**Step 6: Update `.prettierrc`**

```json
{
  "printWidth": 100,
  "tabWidth": 2,
  "useTabs": false,
  "semi": true,
  "singleQuote": false,
  "trailingComma": "es5"
}
```

**Step 7: Update `.gitignore`**

```
node_modules
.env
.env.*
!.env.example
dist
.vercel
*.db
.DS_Store
```

**Step 8: Install dependencies**

```bash
pnpm install
```

**Step 9: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: No errors (no source files yet, just confirming config).

**Step 10: Commit**

```bash
git add -A
git commit -m "chore: replace SvelteKit monorepo with LINE Bot project scaffold"
```

---

## Task 2: Database Schema

Create the 4-table Drizzle schema matching the design document.

**Files:**

- Create: `src/db/schema.ts`, `src/db/client.ts`, `drizzle.config.ts`

**Step 1: Create `src/db/schema.ts`**

```typescript
import { pgTable, text, integer, timestamp, uuid, pgEnum, uniqueIndex } from "drizzle-orm/pg-core";

export const locationEnum = pgEnum("location", ["north", "central", "south", "east"]);

export const groupStatusEnum = pgEnum("group_status", ["open", "full", "completed", "cancelled"]);

export const memberStatusEnum = pgEnum("member_status", ["accepted", "attended", "no_show"]);

export const subscriptionTypeEnum = pgEnum("subscription_type", ["room", "studio", "location"]);

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  lineUserId: text("line_user_id").notNull().unique(),
  displayName: text("display_name").notNull(),
  pictureUrl: text("picture_url"),
  attendCount: integer("attend_count").notNull().default(0),
  noShowCount: integer("no_show_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const groups = pgTable("groups", {
  id: uuid("id").defaultRandom().primaryKey(),
  hostId: uuid("host_id")
    .notNull()
    .references(() => users.id),
  roomName: text("room_name").notNull(),
  studio: text("studio"),
  location: locationEnum("location"),
  datetime: timestamp("datetime", { withTimezone: true }),
  maxMembers: integer("max_members").notNull(),
  prefilledMembers: integer("prefilled_members").notNull().default(1),
  status: groupStatusEnum("status").notNull().default("open"),
  lineGroupId: text("line_group_id"),
  lastAnnouncedAt: timestamp("last_announced_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

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

export const subscriptions = pgTable("subscriptions", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  type: subscriptionTypeEnum("type").notNull(),
  value: text("value").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
```

**Step 2: Create `src/db/client.ts`**

```typescript
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.js";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required");

const sql = postgres(connectionString, { ssl: "require" });
export const db = drizzle(sql, { schema });
```

**Step 3: Create `drizzle.config.ts`**

```typescript
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
```

**Step 4: Push schema to database**

```bash
pnpm db:push
```

Expected: Tables created successfully in Neon.

**Step 5: Verify with TypeScript check**

```bash
npx tsc --noEmit
```

Expected: No errors.

**Step 6: Commit**

```bash
git add src/db/ drizzle.config.ts
git commit -m "feat: add Drizzle schema for users, groups, members, subscriptions"
```

---

## Task 3: Config & LINE Client

Set up environment configuration and LINE API client.

**Files:**

- Create: `src/config.ts`, `src/line/client.ts`, `src/line/verify.ts`
- Test: `tests/line/verify.test.ts`

**Step 1: Create `src/config.ts`**

```typescript
function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

export const config = {
  lineChannelSecret: required("LINE_CHANNEL_SECRET"),
  lineChannelAccessToken: required("LINE_CHANNEL_ACCESS_TOKEN"),
  lineGroupId: required("LINE_GROUP_ID"),
  liffId: required("LIFF_ID"),
  adminUserIds: (process.env.ADMIN_USER_IDS ?? "").split(",").filter(Boolean),
  cronSecret: process.env.CRON_SECRET ?? "",
};
```

**Step 2: Create `src/line/client.ts`**

```typescript
import { messagingApi } from "@line/bot-sdk";

let _client: messagingApi.MessagingApiClient | null = null;

export function getLineClient(): messagingApi.MessagingApiClient {
  if (!_client) {
    _client = new messagingApi.MessagingApiClient({
      channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN!,
    });
  }
  return _client;
}
```

**Step 3: Create `src/line/verify.ts`**

```typescript
import { validateSignature } from "@line/bot-sdk";

export function verifySignature(body: string, signature: string, channelSecret: string): boolean {
  return validateSignature(body, channelSecret, signature);
}
```

**Step 4: Write test for signature verification**

Create `tests/line/verify.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import crypto from "node:crypto";

// Test the signature verification logic directly
describe("webhook signature verification", () => {
  const channelSecret = "test_secret";

  function sign(body: string): string {
    return crypto.createHmac("SHA256", channelSecret).update(body).digest("base64");
  }

  it("accepts valid signature", () => {
    const body = JSON.stringify({ events: [] });
    const signature = sign(body);
    const hmac = crypto.createHmac("SHA256", channelSecret).update(body).digest("base64");
    expect(hmac).toBe(signature);
  });

  it("rejects invalid signature", () => {
    const body = JSON.stringify({ events: [] });
    const hmac = crypto.createHmac("SHA256", channelSecret).update(body).digest("base64");
    expect(hmac).not.toBe("invalid_signature");
  });
});
```

**Step 5: Run test to verify it passes**

```bash
pnpm test
```

Expected: 2 tests pass.

**Step 6: Commit**

```bash
git add src/config.ts src/line/ tests/
git commit -m "feat: add LINE client, config, and webhook signature verification"
```

---

## Task 4: Hono App & Webhook Endpoint

Create the main Hono application with the LINE webhook endpoint.

**Files:**

- Create: `src/app.ts`, `src/index.ts`, `api/[[...route]].ts`, `src/handlers/webhook.ts`

**Step 1: Create `src/handlers/webhook.ts`**

```typescript
import type { WebhookEvent } from "@line/bot-sdk";
import { handlePostback } from "./postback.js";
import { handleFollow } from "./follow.js";
import { handleJoinEvent } from "./join.js";

export async function handleWebhookEvents(events: WebhookEvent[]): Promise<void> {
  for (const event of events) {
    try {
      switch (event.type) {
        case "postback":
          await handlePostback(event);
          break;
        case "follow":
          await handleFollow(event);
          break;
        case "join":
          await handleJoinEvent(event);
          break;
        case "message":
          // Bot doesn't respond to text messages — interaction is via Rich Menu + Postback
          break;
      }
    } catch (err) {
      console.error(`Error handling ${event.type} event:`, err);
    }
  }
}
```

**Step 2: Create stub handlers**

Create `src/handlers/postback.ts`:

```typescript
import type { PostbackEvent } from "@line/bot-sdk";

export async function handlePostback(event: PostbackEvent): Promise<void> {
  const data = event.postback.data;
  console.log("Postback received:", data);
  // Will be implemented in later tasks
}
```

Create `src/handlers/follow.ts`:

```typescript
import type { FollowEvent } from "@line/bot-sdk";

export async function handleFollow(event: FollowEvent): Promise<void> {
  const userId = event.source.userId;
  console.log("New follower:", userId);
  // Will register user in later tasks
}
```

Create `src/handlers/join.ts`:

```typescript
import type { JoinEvent } from "@line/bot-sdk";

export async function handleJoinEvent(event: JoinEvent): Promise<void> {
  const groupId = event.source.type === "group" ? event.source.groupId : null;
  console.log("Bot joined group:", groupId);
  // Log the group ID so we can add it to env vars
}
```

**Step 3: Create `src/app.ts`**

```typescript
import { Hono } from "hono";
import { verifySignature } from "./line/verify.js";
import { handleWebhookEvents } from "./handlers/webhook.js";

const app = new Hono().basePath("/api");

// LINE Webhook endpoint
app.post("/webhook", async (c) => {
  const signature = c.req.header("x-line-signature");
  if (!signature) return c.json({ error: "Missing signature" }, 401);

  const body = await c.req.text();

  const channelSecret = process.env.LINE_CHANNEL_SECRET;
  if (!channelSecret) return c.json({ error: "Server misconfigured" }, 500);

  if (!verifySignature(body, signature, channelSecret)) {
    return c.json({ error: "Invalid signature" }, 401);
  }

  const parsed = JSON.parse(body);

  // Process events in background (don't block LINE's webhook response)
  handleWebhookEvents(parsed.events).catch((err) => {
    console.error("Error processing webhook events:", err);
  });

  return c.json({ status: "ok" });
});

// Health check
app.get("/health", (c) => c.json({ status: "ok" }));

export default app;
```

**Step 4: Create `src/index.ts` (local dev server)**

```typescript
import { serve } from "@hono/node-server";
import app from "./app.js";

const port = Number(process.env.PORT) || 3000;

serve({ fetch: app.fetch, port }, () => {
  console.log(`Bot server running on http://localhost:${port}`);
});
```

**Step 5: Create `api/[[...route]].ts` (Vercel entry point)**

```typescript
import { handle } from "hono/vercel";
import app from "../src/app.js";

export default handle(app);
```

**Step 6: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: No errors.

**Step 7: Test local server starts**

```bash
LINE_CHANNEL_SECRET=test LINE_CHANNEL_ACCESS_TOKEN=test LINE_GROUP_ID=test LIFF_ID=test DATABASE_URL=postgresql://test:test@localhost/test timeout 3 pnpm dev || true
```

Expected: "Bot server running on http://localhost:3000" then timeout.

**Step 8: Commit**

```bash
git add src/app.ts src/index.ts src/handlers/ api/
git commit -m "feat: add Hono app with LINE webhook endpoint and event routing"
```

---

## Task 5: User Management & Access Control

Upsert users from LINE profile and verify they belong to the big group.

**Files:**

- Create: `src/services/user.ts`, `src/services/access.ts`
- Test: `tests/services/user.test.ts`

**Step 1: Create `src/services/user.ts`**

```typescript
import { db } from "../db/client.js";
import { users } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { getLineClient } from "../line/client.js";

export async function upsertUser(lineUserId: string) {
  const existing = await db.select().from(users).where(eq(users.lineUserId, lineUserId)).limit(1);
  if (existing.length > 0) return existing[0];

  const client = getLineClient();
  const profile = await client.getProfile(lineUserId);

  const [user] = await db
    .insert(users)
    .values({
      lineUserId,
      displayName: profile.displayName,
      pictureUrl: profile.pictureUrl ?? null,
    })
    .returning();

  return user;
}

export async function getUserByLineId(lineUserId: string) {
  const result = await db.select().from(users).where(eq(users.lineUserId, lineUserId)).limit(1);
  return result[0] ?? null;
}
```

**Step 2: Create `src/services/access.ts`**

```typescript
import { getLineClient } from "../line/client.js";

// Cache group member IDs for 5 minutes to avoid excessive API calls
let memberCache: { ids: Set<string>; expiresAt: number } | null = null;
const CACHE_TTL = 5 * 60 * 1000;

export async function getGroupMemberIds(groupId: string): Promise<Set<string>> {
  if (memberCache && Date.now() < memberCache.expiresAt) {
    return memberCache.ids;
  }

  const client = getLineClient();
  const ids = new Set<string>();
  let continuationToken: string | undefined;

  do {
    const response = await client.getGroupMembersIds(groupId, continuationToken);
    for (const id of response.memberIds) {
      ids.add(id);
    }
    continuationToken = response.next ?? undefined;
  } while (continuationToken);

  memberCache = { ids, expiresAt: Date.now() + CACHE_TTL };
  return ids;
}

export async function isGroupMember(groupId: string, userId: string): Promise<boolean> {
  const members = await getGroupMemberIds(groupId);
  return members.has(userId);
}
```

**Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: No errors.

**Step 4: Commit**

```bash
git add src/services/
git commit -m "feat: add user upsert and group membership access control"
```

---

## Task 6: Create Group Service

Backend logic for creating a group and the API endpoint.

**Files:**

- Create: `src/services/group.ts`
- Modify: `src/app.ts` (add POST /api/groups route)
- Test: `tests/services/group.test.ts`

**Step 1: Write failing test**

Create `tests/services/group.test.ts`:

```typescript
import { describe, it, expect } from "vitest";

// Test the validation logic as a pure function
import { validateCreateGroupInput } from "../src/services/group.js";

describe("validateCreateGroupInput", () => {
  it("accepts valid input", () => {
    const result = validateCreateGroupInput({
      roomName: "密室逃脫",
      studio: "密室逃脫工作室",
      location: "north",
      datetime: "2026-04-05T14:00:00+08:00",
      maxMembers: 6,
      prefilledMembers: 1,
    });
    expect(result.ok).toBe(true);
  });

  it("rejects missing roomName", () => {
    const result = validateCreateGroupInput({
      roomName: "",
      maxMembers: 6,
    });
    expect(result.ok).toBe(false);
  });

  it("rejects maxMembers < 2", () => {
    const result = validateCreateGroupInput({
      roomName: "test",
      maxMembers: 1,
    });
    expect(result.ok).toBe(false);
  });

  it("rejects prefilledMembers >= maxMembers", () => {
    const result = validateCreateGroupInput({
      roomName: "test",
      maxMembers: 4,
      prefilledMembers: 4,
    });
    expect(result.ok).toBe(false);
  });

  it("accepts input without optional fields", () => {
    const result = validateCreateGroupInput({
      roomName: "test room",
      maxMembers: 6,
    });
    expect(result.ok).toBe(true);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
pnpm test tests/services/group.test.ts
```

Expected: FAIL — `validateCreateGroupInput` not found.

**Step 3: Create `src/services/group.ts`**

```typescript
import { db } from "../db/client.js";
import { groups, groupMembers } from "../db/schema.js";
import { eq, and, gte, lte, ilike, or, sql, asc } from "drizzle-orm";

type CreateGroupInput = {
  roomName: string;
  studio?: string;
  location?: "north" | "central" | "south" | "east";
  datetime?: string;
  maxMembers: number;
  prefilledMembers?: number;
};

type ValidationResult = { ok: true } | { ok: false; error: string };

export function validateCreateGroupInput(input: Partial<CreateGroupInput>): ValidationResult {
  if (!input.roomName || input.roomName.trim().length === 0) {
    return { ok: false, error: "密室名稱為必填" };
  }
  if (!input.maxMembers || input.maxMembers < 2) {
    return { ok: false, error: "人數上限至少為 2" };
  }
  const prefilled = input.prefilledMembers ?? 1;
  if (prefilled >= input.maxMembers) {
    return { ok: false, error: "已有人數必須小於人數上限" };
  }
  return { ok: true };
}

export async function createGroup(hostId: string, input: CreateGroupInput) {
  const [group] = await db
    .insert(groups)
    .values({
      hostId,
      roomName: input.roomName.trim(),
      studio: input.studio?.trim() || null,
      location: input.location ?? null,
      datetime: input.datetime ? new Date(input.datetime) : null,
      maxMembers: input.maxMembers,
      prefilledMembers: input.prefilledMembers ?? 1,
    })
    .returning();

  return group;
}

export async function getGroupById(groupId: string) {
  const result = await db.select().from(groups).where(eq(groups.id, groupId)).limit(1);
  return result[0] ?? null;
}

export async function getGroupMemberCount(groupId: string): Promise<number> {
  const result = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(groupMembers)
    .where(eq(groupMembers.groupId, groupId));
  return result[0]?.count ?? 0;
}
```

**Step 4: Run test to verify it passes**

```bash
pnpm test tests/services/group.test.ts
```

Expected: All 5 tests pass.

**Step 5: Add POST /api/groups route to `src/app.ts`**

Add these imports and route to `src/app.ts`:

```typescript
import { validateCreateGroupInput, createGroup } from "./services/group.js";
import { upsertUser } from "./services/user.js";
import { isGroupMember } from "./services/access.js";
import { buildGroupCard } from "./line/flex/group-card.js";
import { getLineClient } from "./line/client.js";

// LIFF form submission endpoint
app.post("/groups", async (c) => {
  const body = await c.req.json();
  const lineUserId = body.lineUserId as string;

  if (!lineUserId) return c.json({ error: "Missing lineUserId" }, 400);

  const groupId = process.env.LINE_GROUP_ID!;
  if (!(await isGroupMember(groupId, lineUserId))) {
    return c.json({ error: "Not a group member" }, 403);
  }

  const validation = validateCreateGroupInput(body);
  if (!validation.ok) return c.json({ error: validation.error }, 400);

  const user = await upsertUser(lineUserId);
  const group = await createGroup(user.id, body);

  // Push announcement to big group
  try {
    const card = buildGroupCard({
      ...group,
      hostName: user.displayName,
      currentMembers: group.prefilledMembers,
    });
    const client = getLineClient();
    await client.pushMessage({ to: groupId, messages: [card] });
  } catch (err) {
    console.error("Failed to push announcement:", err);
  }

  return c.json({ id: group.id, status: "created" }, 201);
});
```

Note: `buildGroupCard` will be created in Task 8. This route will not compile until then. That's OK — we'll wire everything together.

**Step 6: Commit**

```bash
git add src/services/group.ts tests/services/
git commit -m "feat: add group creation service with validation"
```

---

## Task 7: Flex Message Builders

Build LINE Flex Message cards for group announcements and daily summary.

**Files:**

- Create: `src/line/flex/group-card.ts`, `src/line/flex/summary.ts`
- Test: `tests/line/flex/group-card.test.ts`

**Step 1: Write failing test**

Create `tests/line/flex/group-card.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { buildGroupCard } from "../../../src/line/flex/group-card.js";

describe("buildGroupCard", () => {
  const baseInput = {
    id: "test-group-id",
    roomName: "笑笑羊牧場",
    studio: "密室逃脫工作室",
    location: "north" as const,
    datetime: new Date("2026-04-05T14:00:00+08:00"),
    maxMembers: 6,
    currentMembers: 3,
    hostName: "小明",
  };

  it("returns a valid Flex Message object", () => {
    const card = buildGroupCard(baseInput);
    expect(card.type).toBe("flex");
    expect(card.altText).toContain("笑笑羊牧場");
  });

  it("shows remaining spots", () => {
    const card = buildGroupCard(baseInput);
    const json = JSON.stringify(card);
    expect(json).toContain("還差 3 人");
  });

  it("shows location label", () => {
    const card = buildGroupCard(baseInput);
    const json = JSON.stringify(card);
    expect(json).toContain("台北");
  });

  it("handles missing optional fields", () => {
    const card = buildGroupCard({
      ...baseInput,
      studio: null,
      location: null,
      datetime: null,
    });
    expect(card.type).toBe("flex");
  });
});
```

**Step 2: Run test to verify it fails**

```bash
pnpm test tests/line/flex/group-card.test.ts
```

Expected: FAIL — module not found.

**Step 3: Create `src/line/flex/group-card.ts`**

```typescript
import type { FlexMessage, FlexBubble } from "@line/bot-sdk";

const LOCATION_LABELS: Record<string, string> = {
  north: "台北",
  central: "台中",
  south: "高雄",
  east: "花東",
};

type GroupCardInput = {
  id: string;
  roomName: string;
  studio: string | null;
  location: string | null;
  datetime: Date | null;
  maxMembers: number;
  currentMembers: number;
  hostName: string;
};

function formatDate(date: Date): string {
  const days = ["日", "一", "二", "三", "四", "五", "六"];
  const m = date.getMonth() + 1;
  const d = date.getDate();
  const day = days[date.getDay()];
  const h = date.getHours().toString().padStart(2, "0");
  const min = date.getMinutes().toString().padStart(2, "0");
  return `${m}/${d} (${day}) ${h}:${min}`;
}

export function buildGroupCard(input: GroupCardInput): FlexMessage {
  const remaining = input.maxMembers - input.currentMembers;
  const locationLabel = input.location ? (LOCATION_LABELS[input.location] ?? input.location) : null;
  const subtitle = [input.studio, locationLabel].filter(Boolean).join(" · ");

  const bodyContents: any[] = [
    {
      type: "text",
      text: input.roomName,
      weight: "bold",
      size: "xl",
      wrap: true,
    },
  ];

  if (subtitle) {
    bodyContents.push({
      type: "text",
      text: subtitle,
      size: "sm",
      color: "#888888",
      margin: "sm",
    });
  }

  if (input.datetime) {
    bodyContents.push({
      type: "box",
      layout: "horizontal",
      margin: "lg",
      contents: [
        { type: "text", text: "📅", size: "sm", flex: 0 },
        { type: "text", text: formatDate(input.datetime), size: "sm", margin: "sm" },
      ],
    });
  }

  bodyContents.push(
    {
      type: "box",
      layout: "horizontal",
      margin: "md",
      contents: [
        { type: "text", text: "👥", size: "sm", flex: 0 },
        {
          type: "text",
          text: `${input.currentMembers}/${input.maxMembers} 人（還差 ${remaining} 人）`,
          size: "sm",
          margin: "sm",
        },
      ],
    },
    {
      type: "text",
      text: `團主：${input.hostName}`,
      size: "xs",
      color: "#aaaaaa",
      margin: "lg",
    }
  );

  const bubble: FlexBubble = {
    type: "bubble",
    body: {
      type: "box",
      layout: "vertical",
      contents: bodyContents,
    },
    footer: {
      type: "box",
      layout: "vertical",
      contents: [
        {
          type: "button",
          style: "primary",
          color: "#06C755",
          action: {
            type: "postback",
            label: "我要加入",
            data: `action=join&groupId=${input.id}`,
            displayText: "我要加入！",
          },
        },
      ],
    },
  };

  return {
    type: "flex",
    altText: `開團：${input.roomName}（還差 ${remaining} 人）`,
    contents: bubble,
  };
}
```

**Step 4: Run test to verify it passes**

```bash
pnpm test tests/line/flex/group-card.test.ts
```

Expected: All 4 tests pass.

**Step 5: Create `src/line/flex/summary.ts`**

```typescript
import type { FlexMessage, FlexBubble } from "@line/bot-sdk";

type SummaryGroup = {
  id: string;
  roomName: string;
  datetime: Date | null;
  maxMembers: number;
  currentMembers: number;
};

type DateGroup = {
  dateLabel: string;
  groups: SummaryGroup[];
};

function formatTime(date: Date): string {
  const h = date.getHours().toString().padStart(2, "0");
  const min = date.getMinutes().toString().padStart(2, "0");
  return `${h}:${min}`;
}

function formatDateLabel(date: Date): string {
  const days = ["日", "一", "二", "三", "四", "五", "六"];
  return `${date.getMonth() + 1}/${date.getDate()} (${days[date.getDay()]})`;
}

export function buildSummaryCard(groups: SummaryGroup[]): FlexMessage {
  // Split groups by date
  const dateGroups: DateGroup[] = [];
  const noDateGroups: SummaryGroup[] = [];

  for (const g of groups) {
    if (!g.datetime) {
      noDateGroups.push(g);
      continue;
    }
    const label = formatDateLabel(g.datetime);
    const existing = dateGroups.find((dg) => dg.dateLabel === label);
    if (existing) {
      existing.groups.push(g);
    } else {
      dateGroups.push({ dateLabel: label, groups: [g] });
    }
  }

  const bodyContents: any[] = [
    {
      type: "text",
      text: "📋 開團彙整",
      weight: "bold",
      size: "lg",
    },
    { type: "separator", margin: "md" },
  ];

  for (const dg of dateGroups) {
    bodyContents.push({
      type: "text",
      text: dg.dateLabel,
      weight: "bold",
      size: "sm",
      margin: "lg",
    });

    for (const g of dg.groups) {
      const time = g.datetime ? formatTime(g.datetime) : "";
      const remaining = g.maxMembers - g.currentMembers;
      bodyContents.push({
        type: "box",
        layout: "horizontal",
        margin: "sm",
        contents: [
          {
            type: "text",
            text: `· ${g.roomName} ${time}`,
            size: "sm",
            flex: 4,
            action: {
              type: "postback",
              label: "查看",
              data: `action=detail&groupId=${g.id}`,
            },
          },
          {
            type: "text",
            text: `${g.currentMembers}/${g.maxMembers}人`,
            size: "sm",
            flex: 1,
            align: "end",
            color: remaining <= 1 ? "#FF0000" : "#888888",
          },
        ],
      });
    }
  }

  if (noDateGroups.length > 0) {
    bodyContents.push({
      type: "text",
      text: "時間未定",
      weight: "bold",
      size: "sm",
      margin: "lg",
    });
    for (const g of noDateGroups) {
      bodyContents.push({
        type: "box",
        layout: "horizontal",
        margin: "sm",
        contents: [
          { type: "text", text: `· ${g.roomName}`, size: "sm", flex: 4 },
          {
            type: "text",
            text: `${g.currentMembers}/${g.maxMembers}人`,
            size: "sm",
            flex: 1,
            align: "end",
            color: "#888888",
          },
        ],
      });
    }
  }

  if (groups.length === 0) {
    bodyContents.push({
      type: "text",
      text: "目前沒有開放的團",
      size: "sm",
      color: "#888888",
      margin: "lg",
    });
  }

  const bubble: FlexBubble = {
    type: "bubble",
    body: {
      type: "box",
      layout: "vertical",
      contents: bodyContents,
    },
  };

  return {
    type: "flex",
    altText: `📋 開團彙整（${groups.length} 團開放中）`,
    contents: bubble,
  };
}
```

**Step 6: Commit**

```bash
git add src/line/flex/ tests/line/
git commit -m "feat: add Flex Message builders for group card and daily summary"
```

---

## Task 8: LIFF Create Group Form

Static HTML page for the group creation form, served from `public/`.

**Files:**

- Create: `public/liff/create-group/index.html`

**Step 1: Create `public/liff/create-group/index.html`**

```html
<!DOCTYPE html>
<html lang="zh-TW">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>開團</title>
    <style>
      * {
        box-sizing: border-box;
        margin: 0;
        padding: 0;
      }
      body {
        font-family: -apple-system, BlinkMacSystemFont, sans-serif;
        background: #f5f5f5;
        padding: 16px;
      }
      .form-group {
        margin-bottom: 16px;
      }
      label {
        display: block;
        font-size: 14px;
        font-weight: 600;
        margin-bottom: 4px;
        color: #333;
      }
      input,
      select {
        width: 100%;
        padding: 12px;
        border: 1px solid #ddd;
        border-radius: 8px;
        font-size: 16px;
      }
      input:focus,
      select:focus {
        outline: none;
        border-color: #06c755;
      }
      .required::after {
        content: " *";
        color: red;
      }
      .hint {
        font-size: 12px;
        color: #888;
        margin-top: 4px;
      }
      button {
        width: 100%;
        padding: 14px;
        background: #06c755;
        color: white;
        border: none;
        border-radius: 8px;
        font-size: 16px;
        font-weight: 600;
        cursor: pointer;
        margin-top: 8px;
      }
      button:disabled {
        background: #ccc;
      }
      .error {
        color: red;
        font-size: 14px;
        margin-top: 8px;
        display: none;
      }
      .row {
        display: flex;
        gap: 12px;
      }
      .row .form-group {
        flex: 1;
      }
    </style>
  </head>
  <body>
    <form id="form">
      <div class="form-group">
        <label class="required">密室名稱</label>
        <input type="text" id="roomName" placeholder="例：笑笑羊牧場" required />
      </div>

      <div class="form-group">
        <label>工作室</label>
        <input type="text" id="studio" placeholder="例：密室逃脫工作室" />
      </div>

      <div class="form-group">
        <label>地區</label>
        <select id="location">
          <option value="">不指定</option>
          <option value="north">北部</option>
          <option value="central">中部</option>
          <option value="south">南部</option>
          <option value="east">東部</option>
        </select>
      </div>

      <div class="form-group">
        <label>活動時間</label>
        <input type="datetime-local" id="datetime" />
        <div class="hint">可之後再決定</div>
      </div>

      <div class="row">
        <div class="form-group">
          <label class="required">人數上限</label>
          <input type="number" id="maxMembers" min="2" max="20" value="6" />
        </div>
        <div class="form-group">
          <label>已有人數</label>
          <input type="number" id="prefilledMembers" min="1" max="19" value="1" />
          <div class="hint">含你自己</div>
        </div>
      </div>

      <div class="error" id="error"></div>
      <button type="submit" id="submitBtn">開團</button>
    </form>

    <script src="https://static.line-scdn.net/liff/edge/2/sdk.js"></script>
    <script>
      const LIFF_ID = "__LIFF_ID__"; // Will be replaced at build time or use env

      async function init() {
        try {
          await liff.init({ liffId: LIFF_ID });
          if (!liff.isLoggedIn()) {
            liff.login();
            return;
          }
        } catch (e) {
          showError("LIFF 初始化失敗：" + e.message);
        }
      }

      function showError(msg) {
        const el = document.getElementById("error");
        el.textContent = msg;
        el.style.display = "block";
      }

      document.getElementById("form").addEventListener("submit", async (e) => {
        e.preventDefault();
        const btn = document.getElementById("submitBtn");
        btn.disabled = true;
        btn.textContent = "送出中...";

        try {
          const profile = await liff.getProfile();
          const datetime = document.getElementById("datetime").value;

          const payload = {
            lineUserId: profile.userId,
            roomName: document.getElementById("roomName").value.trim(),
            studio: document.getElementById("studio").value.trim() || undefined,
            location: document.getElementById("location").value || undefined,
            datetime: datetime ? new Date(datetime).toISOString() : undefined,
            maxMembers: parseInt(document.getElementById("maxMembers").value),
            prefilledMembers: parseInt(document.getElementById("prefilledMembers").value),
          };

          if (!payload.roomName) {
            showError("請填寫密室名稱");
            btn.disabled = false;
            btn.textContent = "開團";
            return;
          }

          const res = await fetch("/api/groups", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });

          if (!res.ok) {
            const data = await res.json();
            throw new Error(data.error || "開團失敗");
          }

          // Send confirmation message to user's chat
          await liff.sendMessages([
            {
              type: "text",
              text: "✅ 開團成功！已在大群發布公告。",
            },
          ]);

          liff.closeWindow();
        } catch (err) {
          showError(err.message);
          btn.disabled = false;
          btn.textContent = "開團";
        }
      });

      init();
    </script>
  </body>
</html>
```

Note: `__LIFF_ID__` needs to be replaced with the actual LIFF ID. Options:

1. Hardcode it after getting the LIFF ID
2. Use a Vercel edge middleware to inject it
3. Load it from a `/api/config` endpoint

For now, hardcode it once the LIFF ID is available.

**Step 2: Commit**

```bash
git add public/
git commit -m "feat: add LIFF create group form"
```

---

## Task 9: Browse & Search Groups

Service and API endpoint for listing and filtering open groups.

**Files:**

- Create: `src/services/search.ts`
- Modify: `src/app.ts` (add GET /api/groups route)
- Test: `tests/services/search.test.ts`

**Step 1: Write failing test**

Create `tests/services/search.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { buildSearchQuery } from "../src/services/search.js";

describe("buildSearchQuery", () => {
  it("returns empty filters for no input", () => {
    const query = buildSearchQuery({});
    expect(query).toEqual({});
  });

  it("parses location filter", () => {
    const query = buildSearchQuery({ location: "north" });
    expect(query.location).toBe("north");
  });

  it("parses date range", () => {
    const query = buildSearchQuery({ dateFrom: "2026-04-01", dateTo: "2026-04-07" });
    expect(query.dateFrom).toBeDefined();
    expect(query.dateTo).toBeDefined();
  });

  it("parses keyword", () => {
    const query = buildSearchQuery({ keyword: "笑笑羊" });
    expect(query.keyword).toBe("笑笑羊");
  });
});
```

**Step 2: Run test to verify it fails**

```bash
pnpm test tests/services/search.test.ts
```

Expected: FAIL.

**Step 3: Create `src/services/search.ts`**

```typescript
import { db } from "../db/client.js";
import { groups, groupMembers, users } from "../db/schema.js";
import { eq, and, gte, lte, ilike, or, sql, asc, count } from "drizzle-orm";

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
      maxMembers: groups.maxMembers,
      prefilledMembers: groups.prefilledMembers,
      status: groups.status,
      hostId: groups.hostId,
      createdAt: groups.createdAt,
      hostName: users.displayName,
      memberCount: sql<number>`(
        SELECT count(*)::int FROM group_members
        WHERE group_members.group_id = ${groups.id}
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
```

**Step 4: Run test to verify it passes**

```bash
pnpm test tests/services/search.test.ts
```

Expected: All 4 tests pass.

**Step 5: Add GET /api/groups route to `src/app.ts`**

```typescript
import { searchGroups, buildSearchQuery } from "./services/search.js";

app.get("/groups", async (c) => {
  const params = {
    location: c.req.query("location"),
    dateFrom: c.req.query("dateFrom"),
    dateTo: c.req.query("dateTo"),
    keyword: c.req.query("keyword"),
  };

  const filters = buildSearchQuery(params);
  const results = await searchGroups(filters);
  return c.json(results);
});
```

**Step 6: Commit**

```bash
git add src/services/search.ts tests/services/search.test.ts
git commit -m "feat: add group browse and search with filters"
```

---

## Task 10: Join Group

Handle the "join" postback when users click the join button on a Flex Message card.

**Files:**

- Create: `src/services/member.ts`
- Modify: `src/handlers/postback.ts`

**Step 1: Create `src/services/member.ts`**

```typescript
import { db } from "../db/client.js";
import { groupMembers, groups } from "../db/schema.js";
import { eq, and, sql } from "drizzle-orm";

type JoinResult =
  | { ok: true }
  | { ok: false; reason: "not_found" | "full" | "already_joined" | "cancelled" };

export async function joinGroup(groupId: string, userId: string): Promise<JoinResult> {
  const group = await db.select().from(groups).where(eq(groups.id, groupId)).limit(1);
  if (group.length === 0) return { ok: false, reason: "not_found" };

  const g = group[0];
  if (g.status === "cancelled") return { ok: false, reason: "cancelled" };

  // Check if already joined
  const existing = await db
    .select()
    .from(groupMembers)
    .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId)))
    .limit(1);
  if (existing.length > 0) return { ok: false, reason: "already_joined" };

  // Check if full
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(groupMembers)
    .where(eq(groupMembers.groupId, groupId));
  const currentMembers = g.prefilledMembers + count;
  if (currentMembers >= g.maxMembers) return { ok: false, reason: "full" };

  // Add member
  await db.insert(groupMembers).values({ groupId, userId });

  // Update status if now full
  if (currentMembers + 1 >= g.maxMembers) {
    await db.update(groups).set({ status: "full" }).where(eq(groups.id, groupId));
  }

  return { ok: true };
}
```

**Step 2: Update `src/handlers/postback.ts`**

```typescript
import type { PostbackEvent } from "@line/bot-sdk";
import { getLineClient } from "../line/client.js";
import { upsertUser } from "../services/user.js";
import { joinGroup } from "../services/member.js";
import { getGroupById, getGroupMemberCount } from "../services/group.js";

export async function handlePostback(event: PostbackEvent): Promise<void> {
  const data = new URLSearchParams(event.postback.data);
  const action = data.get("action");
  const userId = event.source.userId;
  if (!userId) return;

  const client = getLineClient();

  switch (action) {
    case "join": {
      const groupId = data.get("groupId");
      if (!groupId) return;

      const user = await upsertUser(userId);
      const result = await joinGroup(groupId, user.id);

      const messages: Record<string, string> = {
        not_found: "找不到這個團，可能已被取消。",
        full: "這個團已經額滿了！",
        already_joined: "你已經加入這個團了。",
        cancelled: "這個團已被取消。",
      };

      if (!result.ok) {
        await client.replyMessage({
          replyToken: event.replyToken,
          messages: [{ type: "text", text: messages[result.reason] }],
        });
        return;
      }

      const group = await getGroupById(groupId);
      const memberCount = await getGroupMemberCount(groupId);
      const current = (group?.prefilledMembers ?? 1) + memberCount;

      await client.replyMessage({
        replyToken: event.replyToken,
        messages: [
          {
            type: "text",
            text: `✅ 成功加入「${group?.roomName}」！目前 ${current}/${group?.maxMembers} 人。`,
          },
        ],
      });
      break;
    }
  }
}
```

**Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: No errors.

**Step 4: Commit**

```bash
git add src/services/member.ts src/handlers/postback.ts
git commit -m "feat: add join group flow with postback handler"
```

---

## Task 11: Daily Summary Cron

Scheduled job that posts a summary of all open groups to the big group every day at 20:00 台灣時間.

**Files:**

- Create: `src/cron/daily-summary.ts`, `api/cron/daily-summary.ts`

**Step 1: Create `src/cron/daily-summary.ts`**

```typescript
import { db } from "../db/client.js";
import { groups, users, groupMembers } from "../db/schema.js";
import { eq, sql, asc } from "drizzle-orm";
import { getLineClient } from "../line/client.js";
import { buildSummaryCard } from "../line/flex/summary.js";

export async function runDailySummary(lineGroupId: string): Promise<void> {
  const openGroups = await db
    .select({
      id: groups.id,
      roomName: groups.roomName,
      datetime: groups.datetime,
      maxMembers: groups.maxMembers,
      prefilledMembers: groups.prefilledMembers,
      memberCount: sql<number>`(
        SELECT count(*)::int FROM group_members
        WHERE group_members.group_id = ${groups.id}
      )`,
    })
    .from(groups)
    .where(eq(groups.status, "open"))
    .orderBy(asc(groups.datetime), asc(groups.createdAt));

  const summaryGroups = openGroups.map((g) => ({
    id: g.id,
    roomName: g.roomName,
    datetime: g.datetime,
    maxMembers: g.maxMembers,
    currentMembers: g.prefilledMembers + (g.memberCount ?? 0),
  }));

  const card = buildSummaryCard(summaryGroups);
  const client = getLineClient();
  await client.pushMessage({ to: lineGroupId, messages: [card] });

  console.log(`Daily summary sent: ${summaryGroups.length} groups`);
}
```

**Step 2: Create `api/cron/daily-summary.ts`**

```typescript
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { runDailySummary } from "../../src/cron/daily-summary.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Verify cron secret to prevent unauthorized triggers
  const authHeader = req.headers.authorization;
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const lineGroupId = process.env.LINE_GROUP_ID;
  if (!lineGroupId) {
    return res.status(500).json({ error: "LINE_GROUP_ID not configured" });
  }

  try {
    await runDailySummary(lineGroupId);
    return res.json({ status: "ok" });
  } catch (err) {
    console.error("Daily summary cron failed:", err);
    return res.status(500).json({ error: "Failed to run daily summary" });
  }
}
```

**Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: No errors. Note: `@vercel/node` types may need to be installed or the file can use plain `Request`/`Response` types instead.

**Step 4: Commit**

```bash
git add src/cron/ api/cron/
git commit -m "feat: add daily summary cron job"
```

---

## Task 12: Wire Up App Routes & Follow Handler

Connect all services to the Hono app and implement the follow event handler.

**Files:**

- Modify: `src/app.ts` (consolidate all routes)
- Modify: `src/handlers/follow.ts`

**Step 1: Update `src/handlers/follow.ts`**

```typescript
import type { FollowEvent } from "@line/bot-sdk";
import { upsertUser } from "../services/user.js";
import { getLineClient } from "../line/client.js";

export async function handleFollow(event: FollowEvent): Promise<void> {
  const userId = event.source.userId;
  if (!userId) return;

  await upsertUser(userId);

  const client = getLineClient();
  await client.replyMessage({
    replyToken: event.replyToken,
    messages: [
      {
        type: "text",
        text: "歡迎使用密室揪團 Bot！\n\n請使用下方選單來開團或找團。",
      },
    ],
  });
}
```

**Step 2: Finalize `src/app.ts`**

Ensure all routes are connected:

```typescript
import { Hono } from "hono";
import { verifySignature } from "./line/verify.js";
import { handleWebhookEvents } from "./handlers/webhook.js";
import { validateCreateGroupInput, createGroup } from "./services/group.js";
import { upsertUser } from "./services/user.js";
import { isGroupMember } from "./services/access.js";
import { searchGroups, buildSearchQuery } from "./services/search.js";
import { buildGroupCard } from "./line/flex/group-card.js";
import { getLineClient } from "./line/client.js";

const app = new Hono().basePath("/api");

// Health check
app.get("/health", (c) => c.json({ status: "ok" }));

// LINE Webhook
app.post("/webhook", async (c) => {
  const signature = c.req.header("x-line-signature");
  if (!signature) return c.json({ error: "Missing signature" }, 401);

  const body = await c.req.text();
  const channelSecret = process.env.LINE_CHANNEL_SECRET;
  if (!channelSecret) return c.json({ error: "Server misconfigured" }, 500);

  if (!verifySignature(body, signature, channelSecret)) {
    return c.json({ error: "Invalid signature" }, 401);
  }

  const parsed = JSON.parse(body);
  handleWebhookEvents(parsed.events).catch(console.error);

  return c.json({ status: "ok" });
});

// LIFF: Create group
app.post("/groups", async (c) => {
  const body = await c.req.json();
  const lineUserId = body.lineUserId as string;
  if (!lineUserId) return c.json({ error: "Missing lineUserId" }, 400);

  const lineGroupId = process.env.LINE_GROUP_ID!;
  if (!(await isGroupMember(lineGroupId, lineUserId))) {
    return c.json({ error: "Not a group member" }, 403);
  }

  const validation = validateCreateGroupInput(body);
  if (!validation.ok) return c.json({ error: validation.error }, 400);

  const user = await upsertUser(lineUserId);
  const group = await createGroup(user.id, body);

  try {
    const card = buildGroupCard({
      ...group,
      hostName: user.displayName,
      currentMembers: group.prefilledMembers,
    });
    const client = getLineClient();
    await client.pushMessage({ to: lineGroupId, messages: [card] });
  } catch (err) {
    console.error("Failed to push announcement:", err);
  }

  return c.json({ id: group.id, status: "created" }, 201);
});

// Search groups
app.get("/groups", async (c) => {
  const params = {
    location: c.req.query("location"),
    dateFrom: c.req.query("dateFrom"),
    dateTo: c.req.query("dateTo"),
    keyword: c.req.query("keyword"),
  };
  const filters = buildSearchQuery(params);
  const results = await searchGroups(filters);
  return c.json(results);
});

export default app;
```

**Step 3: Run all tests**

```bash
pnpm test
```

Expected: All tests pass.

**Step 4: Commit**

```bash
git add src/app.ts src/handlers/follow.ts
git commit -m "feat: wire up all routes and follow handler"
```

---

## Task 13: Update CLAUDE.md & README

Update project documentation to reflect the new LINE Bot architecture.

**Files:**

- Modify: `CLAUDE.md`, `README.md`

**Step 1: Update `CLAUDE.md`**

Replace the entire content with:

```markdown
# Escape Group Bot

LINE Bot 密室揪團工具 — 為密室逃脫 LINE 社群打造的私人揪團工具。

## Tech Stack

- **Framework**: Hono (TypeScript)
- **Database**: Neon PostgreSQL + Drizzle ORM
- **LINE SDK**: @line/bot-sdk (Messaging API + LIFF)
- **Deployment**: Vercel (Serverless Functions + Cron)
- **Testing**: Vitest

## Project Structure
```

src/
├── app.ts # Hono app with all routes
├── config.ts # Environment configuration
├── index.ts # Local dev server
├── db/ # Database schema and client
├── line/ # LINE API client and Flex builders
├── handlers/ # Webhook event handlers
├── services/ # Business logic
└── cron/ # Scheduled jobs
api/ # Vercel serverless entry points
public/liff/ # LIFF pages (static HTML)
tests/ # Vitest tests

````

## Development

```bash
pnpm install
pnpm dev          # Start local dev server (port 3000)
pnpm test         # Run tests
pnpm db:push      # Push schema to Neon
pnpm check        # TypeScript check
````

## Environment Variables

See `.env.example` for required variables:

- `DATABASE_URL` — Neon PostgreSQL connection string
- `LINE_CHANNEL_SECRET` — LINE Messaging API channel secret
- `LINE_CHANNEL_ACCESS_TOKEN` — LINE channel access token
- `LINE_GROUP_ID` — The big LINE group's ID
- `LIFF_ID` — LIFF app ID for create-group form

## Key Design Decisions

- Private tool for one LINE community (100+ members), not a public platform
- Bot interaction via Rich Menu + LIFF forms, no text commands
- Big group: Bot only posts announcements (no interaction)
- Access control: verify userId is in the big group via LINE API
- Daily summary at 20:00 台灣時間 via Vercel Cron
- Design doc: `docs/plans/2026-03-30-line-bot-redesign.md`

````

**Step 2: Update `README.md`**

Replace with a concise project overview:

```markdown
# Escape Group Bot

LINE Bot 密室揪團工具 — A private LINE Bot for organizing escape room groups within a LINE community.

## Features

- **開團** — Create escape room groups via LIFF form
- **找團** — Browse and search open groups by date, location, keyword
- **加入** — Join groups with one tap
- **每日彙整** — Daily summary announcement at 20:00

## Setup

See `CLAUDE.md` for development instructions.

## License

MIT
````

**Step 3: Update `.github/workflows/` CI**

Check if CI needs updating for the new project structure.

**Step 4: Commit**

```bash
git add CLAUDE.md README.md
git commit -m "docs: update CLAUDE.md and README for LINE Bot architecture"
```

---

## Summary of Implementation Order

| Task | Description           | Key Deliverable                                |
| ---- | --------------------- | ---------------------------------------------- |
| 0    | Prerequisites         | LINE channel, Neon DB, LIFF app                |
| 1    | Project scaffold      | New flat structure, deps installed             |
| 2    | Database schema       | 4 tables in Neon                               |
| 3    | Config & LINE client  | ENV config, API client, signature verification |
| 4    | Hono app & webhook    | Webhook endpoint, event routing                |
| 5    | User & access control | User upsert, group membership check            |
| 6    | Create group          | Validation, DB insert, API endpoint            |
| 7    | Flex Message builders | Group card, summary card                       |
| 8    | LIFF form             | Static HTML create-group form                  |
| 9    | Browse & search       | Filter by location/date/keyword                |
| 10   | Join group            | Postback handler, member management            |
| 11   | Daily summary cron    | Vercel cron at 20:00 TW time                   |
| 12   | Wire up app           | Connect all routes and handlers                |
| 13   | Update docs           | CLAUDE.md, README.md                           |
