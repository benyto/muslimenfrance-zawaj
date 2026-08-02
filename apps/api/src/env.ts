import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().int().default(8787),
  CORS_ORIGIN: z.string().min(1),
  // Whether to trust X-Forwarded-For when deriving request.ip. Set to "true"
  // (or a hop count / CIDR — Fastify accepts all three) ONLY when this
  // service actually runs behind a reverse proxy you control, e.g. the VPS
  // nginx/Caddy vhost. Trusting it on a directly-reachable instance would
  // let any caller spoof their own IP and sidestep the per-IP rate limit.
  TRUST_PROXY: z
    .string()
    .default("false")
    .transform((value) =>
      value === "false" ? false : value === "true" ? true : value,
    ),
  SUPABASE_URL: z.string().url(),
  // Non-secret — same value as apps/web's VITE_SUPABASE_PUBLISHABLE_KEY.
  // Used as the base client key for request-scoped (RLS-respecting) calls.
  SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  SUPABASE_SECRET_KEY: z.string().min(1),
  UPLOADTHING_TOKEN: z.string().min(1),
  STRIPE_SECRET_KEY: z.string().min(1),
  STRIPE_WEBHOOK_SECRET: z.string().min(1),
  // The SPA's own URL — used to build Stripe Checkout/Portal return links.
  // Same value as CORS_ORIGIN in practice, kept separate since they serve
  // different purposes (CORS allow-list vs. a URL Stripe redirects users to).
  SITE_URL: z.string().url(),
  RESEND_API_KEY: z.string().min(1),
  // Must be on a domain verified in Resend — same one used for Supabase
  // Auth's SMTP sender (see Phase 0/2 setup).
  EMAIL_FROM: z
    .string()
    .min(1)
    .default("Rencontre <notifications@login.muslimenfrance.com>"),
});

// Fails fast on boot with a clear message rather than surfacing a confusing
// error the first time a route touches a missing var.
export const env = envSchema.parse(process.env);
