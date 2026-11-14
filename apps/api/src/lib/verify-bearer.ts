import type { User } from "@supabase/supabase-js";
import { supabaseAdmin } from "./supabase-admin.js";

// Verifies a bearer token against Supabase Auth: never trust a client-claimed
// identity, always re-derive it from the token server-side. Used by the auth
// plugin's preHandler.
export async function verifyBearerToken(
  authHeader: string | undefined
): Promise<{ user: User; token: string } | null> {
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : undefined;
  if (!token) return null;

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) return null;
  return { user: data.user, token };
}
