# Voho Tracker

Voho Tracker is a DB-first team time-tracking platform built with Next.js + Supabase.

## Getting Started

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Required Environment

Copy `.env.local.example` to `.env.local` and set:

```bash
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_ANON_KEY=your-anon-key
```

Optional:

```bash
OPENAI_API_KEY=your-openai-api-key
OPENAI_MODEL=gpt-4.1-mini
KPI_SHEET_CSV_URL=https://docs.google.com/spreadsheets/d/<sheet-id>/export?format=csv&gid=<gid>
KPI_SHEET_URL=https://docs.google.com/spreadsheets/d/<sheet-id>/edit?usp=sharing
BOOTSTRAP_ADMIN_SECRET=your-bootstrap-secret
```

## Database Setup

Run `supabase/schema.sql` in Supabase SQL editor, then run your migrations with Supabase CLI.

## What Is Stored

- `public.members`: team member profiles
- `public.projects`: project metadata and color
- `public.time_entries`: normalized entry rows
- `public.daily_member_stats`: day-level totals by member
- `public.sync_events`: sync audit log
- `public.api_quota_locks`: quota/cooldown lock state

## Architecture

- DB-first reads and writes
- Immediate UI updates for start/stop/edit/delete flows
- Server APIs under `src/app/api/*`
- Shared timer + calendar UI in app components

## Notes

- No third-party time-tracking provider integration is required.
- Keep Supabase service-role key server-only.
