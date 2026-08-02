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
import { stripeRoutes, stripeWebhookRoutes } from "./routes/stripe.js";
import { uploadRouter } from "./uploadthing/router.js";

// Separated from server.ts (which calls listen()) so tests can build the
// app and inject requests without binding a real port.
export async function buildApp() {
  const app = Fastify({ logger: true });

  await app.register(helmet);
  await app.register(cors, {
    origin: env.CORS_ORIGIN,
    credentials: false,
    // @fastify/cors defaults to GET,HEAD,POST only — every REST verb our
    // routes actually use needs to be explicit or DELETE/PUT/PATCH requests
    // fail the CORS preflight before ever reaching the route.
    methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE"],
  });
  // global: false — only routes that opt in via `config: { rateLimit }`
  // are throttled; /health etc. stay unlimited.
  await app.register(rateLimit, { global: false });
  await app.register(authPlugin);

  await app.register(healthRoutes);
  await app.register(photoRoutes);
  await app.register(messageRoutes);
  await app.register(stripeRoutes);
  // Own encapsulated scope: registers a raw-body content-type parser that
  // must not leak into any other route's normal JSON body parsing.
  await app.register(stripeWebhookRoutes);
  await app.register(createRouteHandler, {
    router: uploadRouter,
    config: { token: env.UPLOADTHING_TOKEN },
  });

  // Routes for admin moderation, gdpr export/delete, and discover are added
  // here as their respective phases land (see the project plan's
  // "Backend / API layer" section for the full route inventory).

  return app;
}
