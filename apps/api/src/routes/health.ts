import type { FastifyInstance } from "fastify";

export async function healthRoutes(fastify: FastifyInstance) {
  fastify.get("/health", async () => ({ status: "ok" }));

  // Exercises the auth plugin end-to-end without touching any real data —
  // useful to confirm a client's Authorization header actually resolves to
  // a user before wiring up real routes in later phases.
  fastify.get(
    "/health/me",
    { preHandler: fastify.requireAuth },
    async (request) => ({ userId: request.user?.id ?? null })
  );
}
