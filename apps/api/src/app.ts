import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import { createRouteHandler } from "uploadthing/fastify";
import { env } from "./env.js";
import { authPlugin } from "./plugins/auth.js";
import { healthRoutes } from "./routes/health.js";
import { photoRoutes } from "./routes/photos.js";
import { messageRoutes } from "./routes/messages.js";
import { reportRoutes } from "./routes/reports.js";
import { stripeRoutes, stripeWebhookRoutes } from "./routes/stripe.js";
import { adminRoutes } from "./routes/admin.js";
import { gdprRoutes } from "./routes/gdpr.js";
import { uploadRouter } from "./uploadthing/router.js";

// Separated from server.ts (which calls listen()) so tests can build the
// app and inject requests without binding a real port.
export async function buildApp() {
  const app = Fastify({
    logger: true,
    // In production this service sits behind the VPS's reverse proxy, so
    // every connection's socket address is the proxy's — without this,
    // `request.ip` is the proxy for *all* traffic, which silently collapses
    // the per-IP rate limit below into one shared global bucket and records
    // a useless ip_address on every admin_audit_log row. Off by default so
    // a directly-exposed or local instance can't be spoofed via a
    // self-declared X-Forwarded-For.
    trustProxy: env.TRUST_PROXY,
  });

  await app.register(helmet);
  await app.register(cors, {
    origin: env.CORS_ORIGIN,
    credentials: false,
    // @fastify/cors defaults to GET,HEAD,POST only — every REST verb our
    // routes actually use needs to be explicit or DELETE/PUT/PATCH requests
    // fail the CORS preflight before ever reaching the route.
    methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE"],
  });
  // Layer 1 of 2 — a broad per-IP ceiling on *every* route, including the
  // unauthenticated ones. This is what protects requireAuth itself: each
  // call there costs a network round trip to Supabase Auth to verify the
  // bearer token, so without this an attacker could burn that (and our
  // Supabase Auth quota) for free by spraying junk tokens.
  //
  // Layer 2 is per-user and lives in lib/user-rate-limit.ts, applied as a
  // preHandler after requireAuth on the routes that need a tighter,
  // per-identity budget. Deliberately NOT `config: { rateLimit }` on those
  // routes: that would *replace* this global limit rather than stack with
  // it, and would key on an unverified token claim.
  await app.register(rateLimit, {
    global: true,
    max: 300,
    timeWindow: "1 minute",
    // Stripe's webhook is signature-verified and must never be throttled —
    // a dropped event means a subscription silently drifts out of sync.
    allowList: (request) => request.url === "/stripe/webhook",
  });
  await app.register(authPlugin);

  await app.register(healthRoutes);
  await app.register(photoRoutes);
  await app.register(messageRoutes);
  await app.register(reportRoutes);
  await app.register(stripeRoutes);
  // Own encapsulated scope: registers a raw-body content-type parser that
  // must not leak into any other route's normal JSON body parsing.
  await app.register(stripeWebhookRoutes);
  await app.register(createRouteHandler, {
    router: uploadRouter,
    config: { token: env.UPLOADTHING_TOKEN },
  });
  await app.register(adminRoutes);
  await app.register(gdprRoutes);

  return app;
}
