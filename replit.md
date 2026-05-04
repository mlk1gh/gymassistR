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
- **Auth**: Custom JWT (`jsonwebtoken` + `bcryptjs` on server, `AuthContext` on client)

## Authentication

GymAssist uses custom JWT authentication (email + password).

- `/` redirects unauthenticated users to `/sign-in`; signed-in users go to `/dashboard`
- Sign-in at `/sign-in`, sign-up at `/sign-up` — custom email/password forms
- All app routes are protected via `AuthProvider` + `ProtectedRoute` (redirect to `/sign-in`)
- API routes under `/api/*` require `Authorization: Bearer <token>` header (returns 401 if missing)
- Public auth routes: `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`
- JWT payload: `{ userId, email, name, isAdmin }` — signed with `SESSION_SECRET`, expires 7d
- Token stored in `localStorage` as `gymassist_token`; `setAuthTokenGetter` wires it to all generated API hooks
- Data is scoped per user via `clerkUserId` column (stores `String(user.id)`) on workouts, healthMetrics, chatMessages tables
- Admin check: `isAdmin` flag in `users` table + `ADMIN_EMAILS` env var override on login
- Ban = set `banned: true` in users table; banned users cannot log in

## Django Admin

A separate Django service provides a full database management panel.

- URL: `/django-admin/admin/`
- Login with Django superuser credentials (separate from the app's JWT users)
- Default superuser: username `admin`, password `gymassist_admin` (override with `DJANGO_ADMIN_USER`, `DJANGO_ADMIN_PASSWORD`, `DJANGO_ADMIN_EMAIL` env vars)
- All tables exposed with full CRUD: App Users, Exercises, Workouts, Workout Exercises, Health Metrics, Chat Messages
- Django uses `managed = False` models — schema is owned by Drizzle, Django only reads/writes data
- Django auth tables (`auth_user`, `auth_*`, `django_*`) are separate from the app's `users` table
- Static files served via Whitenoise at `/django-admin/static/`
- Located in `artifacts/django-admin/`; Python packages in `requirements.txt`

## App Structure

- `/` — Redirects: signed-in → /dashboard, signed-out → /sign-in
- `/sign-in`, `/sign-up` — Clerk auth pages
- `/dashboard` — Dashboard with stats, activity, and weight trend chart
- `/workouts` — Workout plan CRUD with mark-complete
- `/exercises` — Exercise library (shared) with search and filter
- `/health` — Health metric logging and trend charts
- `/chat` — AI coach chat (OpenAI gpt-5.2, per-user history)
- `/profile` — User profile editing (name, age, height, weight, fitness goal)

## User Profile

Users can edit their personal data at `/profile`:
- **Fields**: display name, age, height (cm), weight (kg), fitness goal (free text)
- **DB columns added**: `age INTEGER`, `height_cm REAL`, `weight_kg REAL`, `fitness_goal VARCHAR(512)` on the `users` table
- **API**: `GET /api/user/profile` and `PATCH /api/user/profile` — both require Bearer token
- **Frontend**: `artifacts/gymassist/src/pages/profile.tsx`, registered in `App.tsx`, linked in sidebar nav

## GitHub Sync

Push the current codebase to GitHub at the end of each session.

**Setup (one-time):**
1. Generate a GitHub Personal Access Token (classic) with `repo` scope at https://github.com/settings/tokens
2. Add it as a secret named `GITHUB_TOKEN` in the Replit Secrets panel

**Push commands:**
```bash
# Push main branch (most common)
pnpm run push-github

# Push a specific branch
bash scripts/push-to-github.sh my-feature-branch
```

**Notes:**
- Remote used: `github` → `https://github.com/mlk1gh/gymassistR.git`
- Credentials are injected transiently via git credential helper — PAT is **never** written to `.git/config` or the remote URL
- The script creates/updates the `github` remote automatically if needed
- Convention: always push `main` (the platform-managed branch Replit commits to)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
