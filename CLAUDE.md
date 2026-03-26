# Escape Group

密室逃脫揪團平台 MVP

## Tech Stack

- **Framework**: SvelteKit (Svelte 5 with runes)
- **Monorepo**: pnpm workspaces
- **Database**: PostgreSQL + Drizzle ORM
- **Auth**: Arctic (Facebook OAuth) + Oslo (session tokens)
- **Styling**: Tailwind CSS v4
- **Deployment**: Vercel / Cloudflare Pages

## Project Structure

```
apps/web/          → SvelteKit app (frontend + API routes)
packages/db/       → Drizzle schema, migrations, seed script
packages/shared/   → Shared constants and TypeScript types
```

## Development

```bash
# Start PostgreSQL (requires Docker)
docker compose up -d

# Install dependencies
pnpm install

# Push schema to database
pnpm db:push

# Seed demo data (optional)
pnpm db:seed

# Start dev server
pnpm dev
```

## Environment Variables

Copy `apps/web/.env.example` to `apps/web/.env` and fill in:

- `DATABASE_URL` — PostgreSQL connection string
- `FB_APP_ID` — Facebook app ID
- `FB_APP_SECRET` — Facebook app secret
- `ORIGIN` — App origin (http://localhost:5173 for dev)

## Key Design Decisions

- Phone verification uses in-memory store for MVP (console logs codes). Swap for Twilio in production.
- Credit score: attend +2, no_show -20, reported -10. Flag threshold at 40.
- No data scraping from third-party sites (legal restriction).
- All dates stored with timezone in PostgreSQL.
