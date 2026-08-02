import type { User } from "@supabase/supabase-js";
import { supabaseAdmin } from "./supabase-admin.js";

// Shared by the Fastify auth plugin (preHandler) and the UploadThing file
// router's .middleware() — the latter doesn't run through Fastify's
// preHandler chain, so it needs its own way to verify the caller's JWT
// against Supabase Auth using the same rule: never trust a client-claimed
// identity, always re-derive it from the token server-side.
export async function verifyBearerToken(
  authHeader: string | undefined
): Promise<{ user: User; token: string } | null> {
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : undefined;
  if (!token) return null;

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) return null;
  return { user: data.user, token };
}
