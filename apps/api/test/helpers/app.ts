import { env } from "./env.js";

// The real API, running inside the test process, against the real Supabase
// stack — with Stripe replaceable. Most tests talk to a separately started API
// over HTTP (see ci.yml), which cannot be told "Stripe fails now" or "this read
// returns an error". This one can: the Stripe client and the Supabase service
// client are the same objects the routes use, so a test can replace their
// methods (node:test `mock`) for the length of a case.
//
// It never uses a real Stripe key — STRIPE_SECRET_KEY is forced to a placeholder
// and every Stripe call a test cares about is mocked.
export const IN_PROCESS_WEBHOOK_SECRET = "whsec_in_process_tests";

export async function startApp() {
  Object.assign(process.env, {
    CORS_ORIGIN: "http://localhost:5173",
    SITE_URL: "http://localhost:5173",
    SUPABASE_URL: env.supabaseUrl,
    SUPABASE_PUBLISHABLE_KEY: env.anonKey,
    SUPABASE_SECRET_KEY: env.serviceKey,
    STRIPE_SECRET_KEY: "sk_test_placeholder",
    STRIPE_WEBHOOK_SECRET: IN_PROCESS_WEBHOOK_SECRET,
    RESEND_API_KEY: "re_in_process_placeholder",
    RATE_LIMIT_MAX: "100000",
  });

  const { buildApp } = await import("../../src/app.js");
  const { stripe } = await import("../../src/lib/stripe.js");
  const { supabaseAdmin } = await import("../../src/lib/supabase-admin.js");

  const app = await buildApp();
  await app.listen({ port: 0, host: "127.0.0.1" });
  const address = app.server.address();
  const url = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
  process.env.TEST_API_URL = url;

  return { app, url, stripe, supabaseAdmin, close: () => app.close() };
}
