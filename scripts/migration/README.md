One-off data migration scripts (old muslimenfrance Supabase project → this
project), run in order. Built and run in Phase 10, against the live
projects — see the "Data migration" section of the project plan for the
full findings (only 3 of 23 monolith profiles have a real backing account;
subscriptions were skipped entirely — the only Stripe-platform one no
longer exists in Stripe at all).

Copy `.env.local.example` to `.env.local` (gitignored) and fill in real
credentials before running anything. Each script is idempotent to _read_
but NOT to re-run destructively — re-running 02/04/05/06/07 against an
already-migrated project will create duplicate rows (or fail on the
now-existing primary keys, which is the safer failure mode). 01 and 03 are
safe to re-run any time; 08 is read-only.

lib/clients.ts Supabase clients (monolith + this project), reads .env.local
lib/io.ts JSON read/write helpers for .output/*.json between steps

01-export-old-data.ts Snapshot of every monolith row this migration touches -> .output/export.json
02-create-auth-users.ts Create/reuse destination auth users -> .output/user-map.json
03-migrate-cities.ts Match monolith cities to communes_fr by postal code/name -> .output/city-map.json
04-migrate-profiles.ts Insert profiles (ids preserved, special_category_consent backfilled true)
  05-migrate-photos.ts                Download each monolith photo, re-encode it (WebP, metadata dropped) and store it in the
                                      private Supabase Storage bucket, then insert the profile_photos row. Run from apps/api.
06-migrate-conversations-messages.ts Insert conversations then messages, in created_at order
07-migrate-blocks.ts Insert the monolith's blocks as profile_ignores (user_blocks was retired)
08-verify.ts Row-count diffs + message-ordering spot checks

Run each with: `npx tsx scripts/migration/<file>.ts` from the repo root.

.output/ holds intermediate JSON state between steps (gitignored — contains
real emails/user ids). Delete it before a from-scratch re-run.
