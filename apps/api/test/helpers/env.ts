// Everything the integration suite needs to know about where it is running.
//
// These tests create real users, photos, messages and reports and delete them
// again. That is exactly what you want against a throwaway Supabase stack (CI
// starts one with `supabase start`) and exactly what you do NOT want against a
// database with real members in it. So the suite refuses to start unless the
// target is local, or the person running it has said out loud that it is safe.
function need(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing ${name}. The integration tests need a Supabase stack to run against — ` +
        "see the 'test' job in .github/workflows/ci.yml for how CI provides one."
    );
  }
  return value;
}

export const env = {
  supabaseUrl: need("TEST_SUPABASE_URL"),
  anonKey: need("TEST_SUPABASE_ANON_KEY"),
  serviceKey: need("TEST_SUPABASE_SERVICE_KEY"),
  apiUrl: process.env.TEST_API_URL ?? "http://localhost:8787",
  // Must equal the API's STRIPE_WEBHOOK_SECRET so signed test events verify.
  webhookSecret: process.env.TEST_STRIPE_WEBHOOK_SECRET ?? "",
};

const host = new URL(env.supabaseUrl).hostname;
export const isLocal = host === "localhost" || host === "127.0.0.1" || host === "::1" || host === "host.docker.internal";
if (!isLocal && process.env.ALLOW_REMOTE_TEST_DB !== "yes-this-database-may-receive-test-data") {
  throw new Error(
    `Refusing to run: TEST_SUPABASE_URL points at ${host}, which is not a local stack. ` +
      "These tests write and delete data. Run them against `supabase start`, or — only for a " +
      "database you accept test rows in — set ALLOW_REMOTE_TEST_DB=yes-this-database-may-receive-test-data."
  );
}
