# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Auth**: Clerk (`@clerk/express` server, `@clerk/react` client)

## Authentication

GymAssist uses Clerk for authentication with full proxy support.

- `/` redirects unauthenticated users to `/sign-in`; signed-in users go to `/dashboard`
- Sign-in at `/sign-in`, sign-up at `/sign-up` (Clerk hosted UI)
- All app routes (`/dashboard`, `/workouts`, `/exercises`, `/health`, `/chat`) are protected — unauthenticated access redirects to `/sign-in`
- API routes under `/api/*` require a valid Clerk session (returns 401 if not)
- Data is scoped per user via `clerkUserId` column on workouts, healthMetrics, chatMessages tables
- Exercises table is shared/global (no userId — shared library)
- Sign-out button in sidebar, redirects to `/sign-in`
- Manage users via the Auth pane in the workspace toolbar

## App Structure

- `/` — Redirects: signed-in → /dashboard, signed-out → /sign-in
- `/sign-in`, `/sign-up` — Clerk auth pages
- `/dashboard` — Dashboard with stats, activity, and weight trend chart
- `/workouts` — Workout plan CRUD with mark-complete
- `/exercises` — Exercise library (shared) with search and filter
- `/health` — Health metric logging and trend charts
- `/chat` — AI coach chat (OpenAI gpt-5.2, per-user history)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
