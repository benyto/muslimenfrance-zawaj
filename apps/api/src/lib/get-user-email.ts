import { supabaseAdmin } from "./supabase-admin.js";

// auth.users isn't queryable via the normal REST client (it's not in the
// `public` schema) — the admin API is the documented way to look up a
// user's email server-side.
export async function getUserEmail(userId: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin.auth.admin.getUserById(userId);
  if (error || !data.user?.email) return null;
  return data.user.email;
}
