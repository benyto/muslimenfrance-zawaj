import { createClient } from "@supabase/supabase-js";
import type { Database } from "@rencontre/shared";
import { env } from "../env.js";

// Request-scoped client, created fresh per call with the caller's own JWT —
// RLS applies exactly as it would if the SPA queried Postgres directly.
// Use this for anything that should respect the caller's own permissions;
// reach for supabaseAdmin only for the specific privileged operation a
// route exists to perform.
//
// Base key must be the publishable key, not the secret key: PostgREST
// derives the effective Postgres role from the Authorization header's JWT
// (overridden below to the caller's token), while the publishable key here
// only identifies the project. Passing the secret key as the base client
// key would be redundant at best and a footgun if this Authorization
// override were ever accidentally dropped.
export function createRequestClient(accessToken: string) {
  return createClient<Database>(env.SUPABASE_URL, env.SUPABASE_PUBLISHABLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}
