One-off data migration scripts (old muslimenfrance Supabase project → this
project), run in order per the "Data migration" section of the project plan.
Populated in Phase 10, after the new schema (Phase 1) is stable.

  01-export-old-data.ts
  02-create-auth-users.ts
  03-migrate-profiles.ts
  04-migrate-photos.ts
  05-migrate-conversations-messages.ts
  06-migrate-blocks.ts
  07-migrate-subscriptions.ts
  08-verify-counts.ts

Run against a staging copy of both projects first — see the plan for the
full checklist before repeating against production.
