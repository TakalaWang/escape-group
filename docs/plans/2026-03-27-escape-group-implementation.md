# Escape Group Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build an MVP escape room group-forming platform with anti-flake identity verification and credit scoring.

**Architecture:** SvelteKit monorepo with pnpm workspaces. PostgreSQL via Drizzle ORM for data. Facebook OAuth + SMS phone verification for identity. Server-side rendering with SvelteKit API routes.

**Tech Stack:** SvelteKit, pnpm workspaces, PostgreSQL, Drizzle ORM, Lucia Auth (Facebook OAuth), Tailwind CSS

---

### Task 1: Scaffold Monorepo

**Files:**
- Create: `pnpm-workspace.yaml`
- Create: `package.json` (root)
- Create: `.gitignore`
- Create: `.nvmrc`

**Step 1: Create root package.json and workspace config**

```json
// package.json
{
  "name": "escape-group",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "pnpm --filter @escape-group/web dev",
    "build": "pnpm --filter @escape-group/web build",
    "db:generate": "pnpm --filter @escape-group/db generate",
    "db:migrate": "pnpm --filter @escape-group/db migrate",
    "db:push": "pnpm --filter @escape-group/db push"
  }
}
```

```yaml
# pnpm-workspace.yaml
packages:
  - "apps/*"
  - "packages/*"
```

```
# .nvmrc
24
```

**Step 2: Create .gitignore**

```
node_modules
.env
.env.*
!.env.example
dist
.svelte-kit
.vercel
*.db
.DS_Store
```

**Step 3: Commit**

```bash
git add -A
git commit -m "chore: scaffold monorepo root"
```

---

### Task 2: Scaffold SvelteKit App

**Files:**
- Create: `apps/web/package.json`
- Create: `apps/web/svelte.config.js`
- Create: `apps/web/vite.config.ts`
- Create: `apps/web/tsconfig.json`
- Create: `apps/web/src/app.html`
- Create: `apps/web/src/app.css`
- Create: `apps/web/src/routes/+page.svelte`
- Create: `apps/web/src/routes/+layout.svelte`
- Create: `apps/web/tailwind.config.js`
- Create: `apps/web/postcss.config.js`

**Step 1: Initialize SvelteKit project**

Run:
```bash
cd /Users/takala/code/escape-group
mkdir -p apps/web
cd apps/web
pnpm create svelte@latest . --template skeleton --types ts --no-install
```

If interactive prompt blocks, manually create the files instead.

**Step 2: Install dependencies**

```bash
cd /Users/takala/code/escape-group
pnpm --filter @escape-group/web add -D @sveltejs/kit @sveltejs/vite-plugin-svelte svelte vite typescript tailwindcss @tailwindcss/vite
```

**Step 3: Configure Tailwind**

In `apps/web/app.css`:
```css
@import "tailwindcss";
```

In `apps/web/vite.config.ts`, add tailwind plugin:
```ts
import tailwindcss from "@tailwindcss/vite";
import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [tailwindcss(), sveltekit()],
});
```

**Step 4: Verify dev server starts**

```bash
cd /Users/takala/code/escape-group
pnpm --filter @escape-group/web dev
```

Expected: Dev server starts on localhost:5173

**Step 5: Commit**

```bash
git add -A
git commit -m "feat: scaffold SvelteKit app with Tailwind"
```

---

### Task 3: Setup Database Package with Drizzle

**Files:**
- Create: `packages/db/package.json`
- Create: `packages/db/src/schema.ts`
- Create: `packages/db/src/index.ts`
- Create: `packages/db/drizzle.config.ts`
- Create: `apps/web/.env.example`

**Step 1: Create db package**

```json
// packages/db/package.json
{
  "name": "@escape-group/db",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts",
    "./schema": "./src/schema.ts"
  },
  "scripts": {
    "generate": "drizzle-kit generate",
    "migrate": "drizzle-kit migrate",
    "push": "drizzle-kit push"
  }
}
```

**Step 2: Install Drizzle dependencies**

```bash
cd /Users/takala/code/escape-group
pnpm --filter @escape-group/db add drizzle-orm postgres
pnpm --filter @escape-group/db add -D drizzle-kit
```

**Step 3: Write schema**

```ts
// packages/db/src/schema.ts
import { pgTable, text, integer, boolean, timestamp, uuid, pgEnum } from "drizzle-orm/pg-core";

export const groupModeEnum = pgEnum("group_mode", ["host", "match", "gather"]);
export const groupStatusEnum = pgEnum("group_status", ["open", "full", "confirmed", "completed", "cancelled"]);
export const memberStatusEnum = pgEnum("member_status", ["pending", "accepted", "attended", "no_show", "excused"]);

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  fbId: text("fb_id").unique().notNull(),
  phone: text("phone").unique(),
  displayName: text("display_name").notNull(),
  avatarUrl: text("avatar_url"),
  creditScore: integer("credit_score").notNull().default(100),
  isFlagged: boolean("is_flagged").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id),
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
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const groups = pgTable("groups", {
  id: uuid("id").primaryKey().defaultRandom(),
  mode: groupModeEnum("mode").notNull(),
  escapeRoomId: uuid("escape_room_id").references(() => escapeRooms.id),
  hostId: uuid("host_id").notNull().references(() => users.id),
  datetime: timestamp("datetime", { withTimezone: true }),
  timeRangeStart: timestamp("time_range_start", { withTimezone: true }),
  timeRangeEnd: timestamp("time_range_end", { withTimezone: true }),
  maxMembers: integer("max_members").notNull(),
  minCredit: integer("min_credit").notNull().default(0),
  autoAccept: boolean("auto_accept").notNull().default(true),
  status: groupStatusEnum("status").notNull().default("open"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const groupMembers = pgTable("group_members", {
  id: uuid("id").primaryKey().defaultRandom(),
  groupId: uuid("group_id").notNull().references(() => groups.id),
  userId: uuid("user_id").notNull().references(() => users.id),
  status: memberStatusEnum("status").notNull().default("pending"),
  joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
});

export const reports = pgTable("reports", {
  id: uuid("id").primaryKey().defaultRandom(),
  reporterId: uuid("reporter_id").notNull().references(() => users.id),
  reportedUserId: uuid("reported_user_id").notNull().references(() => users.id),
  groupId: uuid("group_id").notNull().references(() => groups.id),
  reason: text("reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
```

**Step 4: Write db client**

```ts
// packages/db/src/index.ts
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.js";

export function createDb(connectionString: string) {
  const client = postgres(connectionString);
  return drizzle(client, { schema });
}

export type Database = ReturnType<typeof createDb>;
export * from "./schema.js";
```

**Step 5: Write drizzle config**

```ts
// packages/db/drizzle.config.ts
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
```

**Step 6: Create .env.example**

```
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/escape_group
FB_APP_ID=
FB_APP_SECRET=
```

**Step 7: Commit**

```bash
git add -A
git commit -m "feat: add database package with Drizzle schema"
```

---

### Task 4: Wire DB to SvelteKit

**Files:**
- Modify: `apps/web/package.json` (add db dependency)
- Create: `apps/web/src/lib/server/db.ts`
- Create: `apps/web/.env` (local, gitignored)

**Step 1: Add db dependency to web app**

```bash
cd /Users/takala/code/escape-group
pnpm --filter @escape-group/web add @escape-group/db
```

**Step 2: Create server-side db helper**

```ts
// apps/web/src/lib/server/db.ts
import { createDb } from "@escape-group/db";
import { env } from "$env/dynamic/private";

export const db = createDb(env.DATABASE_URL!);
```

**Step 3: Commit**

```bash
git add -A
git commit -m "feat: wire database to SvelteKit app"
```

---

### Task 5: Auth — Facebook OAuth + Session

**Files:**
- Create: `apps/web/src/lib/server/auth.ts`
- Create: `apps/web/src/routes/auth/facebook/+server.ts`
- Create: `apps/web/src/routes/auth/facebook/callback/+server.ts`
- Create: `apps/web/src/routes/auth/logout/+server.ts`
- Create: `apps/web/src/hooks.server.ts`

**Step 1: Install auth dependencies**

```bash
pnpm --filter @escape-group/web add arctic oslo
```

Arctic handles OAuth flows. Oslo provides crypto utilities for session tokens.

**Step 2: Create auth utilities**

```ts
// apps/web/src/lib/server/auth.ts
import { Facebook } from "arctic";
import { sha256 } from "oslo/crypto";
import { encodeHex } from "oslo/encoding";
import { env } from "$env/dynamic/private";
import { db } from "./db.js";
import { sessions, users } from "@escape-group/db/schema";
import { eq } from "drizzle-orm";

export const facebook = new Facebook(
  env.FB_APP_ID!,
  env.FB_APP_SECRET!,
  env.ORIGIN + "/auth/facebook/callback"
);

export async function createSession(userId: string) {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const token = encodeHex(bytes);
  const hashedToken = encodeHex(new Uint8Array(await sha256(new TextEncoder().encode(token))));
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

  await db.insert(sessions).values({
    id: hashedToken,
    userId,
    expiresAt,
  });

  return token;
}

export async function validateSession(token: string) {
  const hashedToken = encodeHex(new Uint8Array(await sha256(new TextEncoder().encode(token))));
  const [session] = await db.select().from(sessions).where(eq(sessions.id, hashedToken));
  if (!session || session.expiresAt < new Date()) return null;

  const [user] = await db.select().from(users).where(eq(users.id, session.userId));
  return user ?? null;
}

export async function invalidateSession(token: string) {
  const hashedToken = encodeHex(new Uint8Array(await sha256(new TextEncoder().encode(token))));
  await db.delete(sessions).where(eq(sessions.id, hashedToken));
}
```

**Step 3: Create OAuth routes**

Facebook login redirect (`/auth/facebook`), callback handler (`/auth/facebook/callback`), and logout (`/auth/logout`). The callback upserts the user and creates a session cookie.

**Step 4: Create hooks for session validation**

```ts
// apps/web/src/hooks.server.ts
import { validateSession } from "$lib/server/auth";
import type { Handle } from "@sveltejs/kit";

export const handle: Handle = async ({ event, resolve }) => {
  const token = event.cookies.get("session");
  if (token) {
    const user = await validateSession(token);
    event.locals.user = user;
  }
  return resolve(event);
};
```

**Step 5: Add app.d.ts types**

```ts
// apps/web/src/app.d.ts
declare global {
  namespace App {
    interface Locals {
      user: import("@escape-group/db/schema").InferSelectModel<typeof import("@escape-group/db/schema").users> | null;
    }
  }
}
export {};
```

**Step 6: Commit**

```bash
git add -A
git commit -m "feat: add Facebook OAuth authentication"
```

---

### Task 6: Phone Verification API

**Files:**
- Create: `apps/web/src/routes/auth/phone/+server.ts`
- Create: `apps/web/src/routes/auth/phone/verify/+server.ts`

**Step 1: Create phone verification endpoints**

For MVP, use a simple 6-digit code stored in-memory (or DB). Twilio integration can be swapped in later.

- `POST /auth/phone` — send verification code to phone number
- `POST /auth/phone/verify` — verify code, bind phone to user

**Step 2: Commit**

```bash
git add -A
git commit -m "feat: add phone verification API"
```

---

### Task 7: Group CRUD API

**Files:**
- Create: `apps/web/src/routes/api/groups/+server.ts` (GET list, POST create)
- Create: `apps/web/src/routes/api/groups/[id]/+server.ts` (GET detail, PATCH update)
- Create: `apps/web/src/routes/api/groups/[id]/join/+server.ts` (POST join)
- Create: `apps/web/src/routes/api/groups/[id]/members/+server.ts` (GET members, PATCH update status)

**Step 1: Create group list + create endpoint**

- `GET /api/groups` — list open groups with filters (location, date)
- `POST /api/groups` — create group (requires verified phone)

**Step 2: Create group detail + join endpoints**

- `GET /api/groups/[id]` — group detail with members
- `POST /api/groups/[id]/join` — join group (checks credit score threshold)
- `PATCH /api/groups/[id]/members` — update member status (host only, for attendance)

**Step 3: Commit**

```bash
git add -A
git commit -m "feat: add group CRUD API"
```

---

### Task 8: Credit Score Logic

**Files:**
- Create: `apps/web/src/lib/server/credit.ts`
- Create: `apps/web/src/routes/api/groups/[id]/attendance/+server.ts`
- Create: `apps/web/src/routes/api/reports/+server.ts`

**Step 1: Create credit score module**

```ts
// apps/web/src/lib/server/credit.ts
const CREDIT_ATTEND = 2;
const CREDIT_NO_SHOW = -20;
const CREDIT_REPORTED = -10;
const FLAG_THRESHOLD = 40;

export function calculateCreditChange(action: "attend" | "no_show" | "reported"): number {
  switch (action) {
    case "attend": return CREDIT_ATTEND;
    case "no_show": return CREDIT_NO_SHOW;
    case "reported": return CREDIT_REPORTED;
  }
}
```

**Step 2: Create attendance confirmation endpoint**

Host marks members as attended/no_show/excused → updates credit scores.

**Step 3: Create report endpoint**

Members can report no-shows. Multiple reports trigger additional credit penalty.

**Step 4: Commit**

```bash
git add -A
git commit -m "feat: add credit score and reporting system"
```

---

### Task 9: UI — Layout and Navigation

**Files:**
- Modify: `apps/web/src/routes/+layout.svelte`
- Create: `apps/web/src/lib/components/Navbar.svelte`
- Modify: `apps/web/src/routes/+page.svelte`

**Step 1: Create main layout with navbar**

Navbar shows: logo, browse groups, create group, profile/login button.

**Step 2: Create landing page**

Simple hero section explaining the platform + CTA to browse groups.

**Step 3: Commit**

```bash
git add -A
git commit -m "feat: add layout and navigation UI"
```

---

### Task 10: UI — Group List Page

**Files:**
- Create: `apps/web/src/routes/groups/+page.server.ts`
- Create: `apps/web/src/routes/groups/+page.svelte`
- Create: `apps/web/src/lib/components/GroupCard.svelte`

**Step 1: Create group list page**

Server load function fetches open groups. Display as cards with: escape room name, date, location, spots remaining, host credit score.

**Step 2: Commit**

```bash
git add -A
git commit -m "feat: add group list page"
```

---

### Task 11: UI — Create Group Page

**Files:**
- Create: `apps/web/src/routes/groups/new/+page.svelte`
- Create: `apps/web/src/routes/groups/new/+page.server.ts`

**Step 1: Create group form**

Form with fields based on selected mode (host/match/gather). Escape room fields: name, studio, url, location, player range. Group fields: datetime, max members, min credit, auto accept.

**Step 2: Commit**

```bash
git add -A
git commit -m "feat: add create group page"
```

---

### Task 12: UI — Group Detail Page

**Files:**
- Create: `apps/web/src/routes/groups/[id]/+page.server.ts`
- Create: `apps/web/src/routes/groups/[id]/+page.svelte`

**Step 1: Create group detail page**

Shows: escape room info, member list with credit scores, join button, host controls (accept/reject members, mark attendance).

**Step 2: Commit**

```bash
git add -A
git commit -m "feat: add group detail page"
```

---

### Task 13: UI — Profile Page

**Files:**
- Create: `apps/web/src/routes/profile/+page.server.ts`
- Create: `apps/web/src/routes/profile/+page.svelte`

**Step 1: Create profile page**

Shows: display name, avatar, credit score, phone verification status, group history (past groups with attendance status).

**Step 2: Commit**

```bash
git add -A
git commit -m "feat: add profile page"
```

---

### Task 14: Phone Verification UI

**Files:**
- Create: `apps/web/src/routes/verify-phone/+page.svelte`

**Step 1: Create phone verification page**

Form: enter phone number → receive code → enter code → verified. Redirects back to previous page after verification.

**Step 2: Commit**

```bash
git add -A
git commit -m "feat: add phone verification UI"
```

---

### Task 15: Final Wiring and Polish

**Step 1: Add route guards**

Redirect unauthenticated users from protected routes (create group, join, profile).

**Step 2: Add loading states and error handling**

SvelteKit error pages and form validation.

**Step 3: Verify full flow works**

1. Login with Facebook
2. Verify phone
3. Create a group
4. View group list
5. Join a group
6. Mark attendance
7. Check credit score updated

**Step 4: Commit**

```bash
git add -A
git commit -m "feat: add route guards and polish"
```
