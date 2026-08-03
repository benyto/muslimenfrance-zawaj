import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { UTApi } from "uploadthing/server";
import type { Database } from "@rencontre/shared";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.join(__dirname, "..", ".env.local") });

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing ${name} in scripts/migration/.env.local (see .env.local.example)`);
  }
  return value;
}

// Untyped: the monolith's schema isn't the Database type this package
// generates (that's the destination project's schema).
export const mono = createClient(
  requireEnv("MONOLITH_SUPABASE_URL"),
  requireEnv("MONOLITH_SUPABASE_SECRET_KEY"),
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export const rencontre = createClient<Database>(
  requireEnv("RENCONTRE_SUPABASE_URL"),
  requireEnv("RENCONTRE_SUPABASE_SECRET_KEY"),
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export const utapi = new UTApi({ token: requireEnv("RENCONTRE_UPLOADTHING_TOKEN") });
