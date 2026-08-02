import { createClient } from "@supabase/supabase-js";
import type { Database } from "@rencontre/shared";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabasePublishableKey) {
  throw new Error(
    "Missing VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY — copy apps/web/.env.example to apps/web/.env.local and fill in the new Supabase project's values."
  );
}

// Session is kept in localStorage only (no cookies) — every API call carries
// an explicit Authorization: Bearer header, so classic CSRF doesn't apply here.
export const supabase = createClient<Database>(supabaseUrl, supabasePublishableKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
