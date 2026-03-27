# Escape Group

密室逃脫揪團平台 — 信用制度保障每一場密室體驗。

## Features

- **三種開團模式**
  - 團主制：指定密室、時間、人數
  - 配對制：系統自動配對同好
  - 湊人制：先找人再投票選密室
- **防跳車信用系統** — 出席加分、跳車扣分、低信用警示
- **雙重身份驗證** — Facebook OAuth + 手機號碼綁定
- **檢舉機制** — 多人檢舉觸發信用懲罰

## Quick Start

```bash
# 1. Start PostgreSQL
docker compose up -d

# 2. Install dependencies
pnpm install

# 3. Setup environment
cp apps/web/.env.example apps/web/.env
# Edit .env with your DATABASE_URL (default works with docker-compose)

# 4. Push database schema
pnpm db:push

# 5. Seed demo data (optional)
pnpm db:seed

# 6. Start dev server
pnpm dev
```

Visit `http://localhost:5173`. In dev mode, use the demo login buttons on the landing page.

## Tech Stack

- [SvelteKit](https://svelte.dev/docs/kit) (Svelte 5) — Full-stack framework
- [PostgreSQL](https://www.postgresql.org/) — Database
- [Drizzle ORM](https://orm.drizzle.team/) — Type-safe ORM
- [Tailwind CSS v4](https://tailwindcss.com/) — Styling
- [Arctic](https://arctic.js.org/) — OAuth library
- [Vercel](https://vercel.com/) — Deployment

## Project Structure

```
apps/
  web/                  SvelteKit application
    src/
      lib/
        components/     Svelte components
        server/         Server-side logic (auth, credit, matching, etc.)
      routes/           Pages and API endpoints
packages/
  db/                   Drizzle schema, migrations, seed script
  shared/               Shared TypeScript types and constants
```

## Scripts

| Command            | Description             |
| ------------------ | ----------------------- |
| `pnpm dev`         | Start dev server        |
| `pnpm build`       | Build for production    |
| `pnpm test`        | Run unit tests          |
| `pnpm db:push`     | Push schema to database |
| `pnpm db:generate` | Generate migrations     |
| `pnpm db:seed`     | Seed demo data          |

## Environment Variables

| Variable        | Description                  |
| --------------- | ---------------------------- |
| `DATABASE_URL`  | PostgreSQL connection string |
| `FB_APP_ID`     | Facebook App ID              |
| `FB_APP_SECRET` | Facebook App Secret          |
| `ORIGIN`        | App origin URL               |

## Deployment

The app is configured for Vercel deployment:

```bash
pnpm build
```

Set environment variables in Vercel dashboard, connect a PostgreSQL database (e.g., Neon, Supabase), and deploy.

## License

MIT
