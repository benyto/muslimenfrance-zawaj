import fp from "fastify-plugin";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { User } from "@supabase/supabase-js";
import { supabaseAdmin } from "../lib/supabase-admin.js";
import { createRequestClient } from "../lib/supabase-request.js";
import { verifyBearerToken } from "../lib/verify-bearer.js";

declare module "fastify" {
  interface FastifyRequest {
    user?: User;
    accessToken?: string;
    supabase?: ReturnType<typeof createRequestClient>;
  }
}

// Mirrors the monolith's getRequestUser/requireAuthenticatedRequest/
// requireAdminRequest (lib/auth/guards.ts) — a client-claimed role is never
// trusted; every check re-derives it server-side.
export const authPlugin = fp(async (fastify: FastifyInstance) => {
  fastify.decorateRequest("user", undefined);
  fastify.decorateRequest("accessToken", undefined);
  fastify.decorateRequest("supabase", undefined);

  fastify.decorate("requireAuth", async (request: FastifyRequest, reply: FastifyReply) => {
    const verified = await verifyBearerToken(request.headers.authorization);
    if (!verified) {
      return reply.code(401).send({ error: "Unauthorized" });
    }

    request.user = verified.user;
    request.accessToken = verified.token;
    request.supabase = createRequestClient(verified.token);
  });

  fastify.decorate("requireAdmin", async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.user) {
      return reply.code(401).send({ error: "Unauthorized" });
    }

    const { data, error } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", request.user.id)
      .in("role", ["admin", "moderator"])
      .maybeSingle();

    if (error) {
      request.log.error(error, "Failed to verify admin role");
      return reply.code(500).send({ error: "Failed to verify admin access" });
    }

    if (!data) {
      return reply.code(403).send({ error: "Admin access required" });
    }
  });
});

declare module "fastify" {
  interface FastifyInstance {
    requireAuth: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireAdmin: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}
