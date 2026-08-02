import { createClient } from "@supabase/supabase-js";
import type { Database } from "@rencontre/shared";
import { env } from "../env.js";

// Service-role client — bypasses RLS entirely. Used only for privileged
// operations the API explicitly performs on a caller's behalf (moderation,
// Stripe/UploadThing webhooks, GDPR export/delete). Never pass this client
// or its key to anything request-scoped that a caller could influence.
export const supabaseAdmin = createClient<Database>(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});
