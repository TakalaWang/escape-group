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
├── app.ts                 # Hono app with all routes
├── config.ts              # Environment configuration
├── index.ts               # Local dev server
├── db/                    # Database schema and client
├── line/                  # LINE API client and Flex builders
├── handlers/              # Webhook event handlers
├── services/              # Business logic
└── cron/                  # Scheduled jobs
api/                       # Vercel serverless entry points
public/liff/               # LIFF pages (static HTML)
tests/                     # Vitest tests
docs/plans/                # Design and implementation docs
```

## Development

```bash
pnpm install
pnpm dev          # Start local dev server (port 3000)
pnpm test         # Run tests
pnpm db:push      # Push schema to Neon
pnpm check        # TypeScript check
```

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
