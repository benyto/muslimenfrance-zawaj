# rencontre-muslimenfrance

Standalone dating/matchmaking SPA extracted from the muslimenfrance monolith —
own Supabase project, own schema, own UI/admin, own backend, Supabase
Realtime messaging, UploadThing (restricted mode), Resend email, Stripe
subscriptions with a trial period. See the project plan for the full
architecture and rationale.

## Stack

- **apps/web** — Vite + React Router 8 in SPA mode (`ssr: false`), TypeScript,
  Tailwind CSS 4. Builds to static assets (`apps/web/build/client`) —
  deployable to any static host (not Vercel; host TBD).
- **apps/api** — Node.js + Fastify, self-hosted on the same VPS/server as
  muslimenfrance (not Supabase Edge Functions — a deliberate choice to keep
  the whole privileged backend under our own hosting). Holds every secret
  (`SUPABASE_SECRET_KEY`, Stripe/Resend/UploadThing credentials once those
  phases land) and exposes one JSON route per privileged operation. See
  `apps/api/src/app.ts` for the route inventory as it grows.
- **packages/shared** — Zod validation schemas and generated DB types, shared
  between the SPA and the API (no build step, plain TS).
- **supabase** — schema migrations (`supabase/migrations`, via the Supabase
  CLI) and RPCs. No Supabase Edge Functions — privileged logic lives in
  `apps/api` instead.
- **scripts/migration** — one-off data migration from the old monolith's
  Supabase project into this one (Phase 10).

## Getting started

```bash
npm install
cp apps/web/.env.example apps/web/.env.local   # fill in the new Supabase project's URL/publishable key
cp apps/api/.env.example apps/api/.env         # fill in the same project's URL/publishable+secret key
npm run dev                                    # runs web (:5173) + api (:8787) together
```

Run them individually with `npm run dev:web` / `npm run dev:api` if needed.

Push the schema to the real (hosted) Supabase project — no Docker required
for this, only for the full local emulation (`supabase start`), which this
project doesn't use:

```bash
supabase login
supabase link --project-ref <your-project-ref>
supabase db push
supabase gen types typescript --linked > packages/shared/src/types/db.ts
```

## Status

See [PROJECT_STATUS.md](./PROJECT_STATUS.md) for what's built, what's
deliberately deferred, and where to look for each piece — kept up to date
as the project progresses rather than duplicated here.
