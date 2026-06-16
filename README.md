# Junto

A focused, mobile-first signup app — create an event, define jobs with slots, share one link.

## Stack

- Next.js 16 (App Router, React 19) + TypeScript
- Tailwind CSS v4
- Supabase (Postgres + Auth + Storage) — managed via Supabase CLI
- Resend (transactional email)
- Framer Motion (springs) + Vaul (bottom sheets)

## Routes

- `/` — landing
- `/create` — create an event (no account needed)
- `/recover` — magic-link sign-in
- `/me` — your events (after signing in)
- `/e/[slug]` — public event page; participants claim slots here
- `/manage/[editToken]` — creator view; edit event, add/remove jobs, manage roster
- `/cancel/[cancelToken]` — participant cancels a slot
- `/auth/callback` — Supabase magic-link handler

## Local setup — option A: full local stack (recommended)

Needs Docker Desktop running.

```bash
# 1. start the local Supabase stack (Postgres, Auth, Storage, Studio)
pnpm db:start

# 2. apply the migration (also runs on every reset)
pnpm db:reset

# 3. copy the API/URL output by db:start into .env.local
#    (the local anon + service_role keys are printed by `db:start`)

# 4. run Next.js
pnpm dev
```

Local Supabase Studio: http://localhost:54323.
Local Inbucket (catches outbound auth emails for testing): http://localhost:54324.

## Local setup — option B: cloud Supabase project

```bash
# 1. one-time: sign in to Supabase
supabase login

# 2. link this repo to a cloud project (create one first at supabase.com/dashboard)
pnpm db:link --project-ref <your-project-ref>

# 3. push the migration up
pnpm db:push

# 4. fill .env.local with the cloud project's URL + anon/service_role keys
# 5. run Next.js
pnpm dev
```

## Env vars

Copy `.env.example` to `.env.local` and set:

- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY`
- `RESEND_API_KEY` / `RESEND_FROM` (use `onboarding@resend.dev` for dev sandbox)
- `NEXT_PUBLIC_APP_URL` (`http://localhost:3000` for dev)

## Day-to-day commands

```bash
pnpm dev            # Next.js dev server
pnpm typecheck      # TypeScript
pnpm lint           # ESLint
pnpm build          # Production build

pnpm db:start       # Boot local Supabase (Docker)
pnpm db:reset       # Drop + re-apply all migrations + seed
pnpm db:diff <name> # Create a new migration from local DB changes
pnpm db:push        # Push migrations to the linked cloud project
pnpm db:types       # Regenerate TypeScript types from the local schema
```
