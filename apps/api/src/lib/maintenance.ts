import type { FastifyBaseLogger } from "fastify";
import { env } from "../env.js";
import { supabaseAdmin } from "./supabase-admin.js";

const DAY_MS = 24 * 60 * 60 * 1000;

/** One cleanup pass. Never throws: housekeeping must not take the API down. */
export async function pruneWebhookEvents(log: Pick<FastifyBaseLogger, "info" | "error">) {
  const { data, error } = await supabaseAdmin.rpc("prune_webhook_events", {
    p_older_than_days: env.WEBHOOK_EVENT_RETENTION_DAYS,
  });
  if (error) {
    log.error(error, "Pruning old webhook events failed");
    return;
  }
  if (data > 0) {
    log.info({ deleted: data, olderThanDays: env.WEBHOOK_EVENT_RETENTION_DAYS }, "Pruned old webhook events");
  }
}

/**
 * Housekeeping that runs inside the API process: once at startup, then daily.
 * Safe with several instances — the delete is idempotent, so two running it
 * at once just means one of them finds nothing left to do.
 */
export function startMaintenance(log: Pick<FastifyBaseLogger, "info" | "error">) {
  void pruneWebhookEvents(log);
  // unref: this timer alone must never keep the process alive on shutdown.
  setInterval(() => void pruneWebhookEvents(log), DAY_MS).unref();
}
