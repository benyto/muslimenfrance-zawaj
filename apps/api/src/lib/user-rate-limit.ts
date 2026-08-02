import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

// Per-user rate limiting, layered *on top of* the global per-IP limit
// registered in app.ts.
//
// Why not `config: { rateLimit }` on the route: that replaces the global
// limit for that route rather than stacking with it (see the plugin's
// onRoute hook — a route with its own config never gets the global hook),
// and its keyGenerator runs at onRequest, before any authentication has
// happened. Keying on identity at that point means keying on an *unverified*
// claim decoded out of the bearer token, which an attacker can vary freely
// to mint themselves an unlimited number of fresh buckets.
//
// `createRateLimit` returns a bare checker with no such coupling, so this
// runs as a preHandler ordered *after* requireAuth — `request.user` is set
// only once the token has actually been verified against Supabase Auth, so
// the key can never be attacker-chosen. Forged tokens are rejected by
// requireAuth before reaching here, and are absorbed by the global per-IP
// limit instead.
export function userRateLimit(
  fastify: FastifyInstance,
  options: { max: number; timeWindow: string },
) {
  const check = fastify.createRateLimit({
    ...options,
    keyGenerator: (request: FastifyRequest) =>
      `user:${request.user?.id ?? request.ip}`,
  });

  return async function userRateLimitPreHandler(
    request: FastifyRequest,
    reply: FastifyReply,
  ) {
    const result = await check(request);
    // `isAllowed: true` is the allow-list short-circuit and carries no
    // counters; only the other branch can be over budget.
    if (!result.isAllowed && result.isExceeded) {
      return reply
        .code(429)
        .header("retry-after", String(result.ttlInSeconds))
        .send({
          error: "Trop de requêtes, réessayez plus tard.",
          retryAfter: result.ttlInSeconds,
        });
    }
  };
}
