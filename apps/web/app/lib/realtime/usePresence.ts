import { useEffect, useState } from "react";
import { supabase } from "~/lib/supabase-client";

const HEARTBEAT_INTERVAL_MS = 60_000;
// Comfortably above HEARTBEAT_INTERVAL_MS so a client isn't flickering to
// "offline" between two heartbeats over an ordinary network hiccup.
const ONLINE_THRESHOLD_MS = 120_000;

/**
 * WhatsApp-style online/offline, without a realtime channel: bump
 * profiles.last_seen_at on a throttled interval while the tab is visible
 * and the user has opted in, and let every reader derive "online" from how
 * recent that timestamp is (usePresenceStatus). Replaces an earlier
 * version built on a single global Supabase Realtime Presence channel —
 * that channel's join/leave/sync events fan out to every other connected
 * client, so cost scaled with concurrent-user-count × churn. A plain column
 * has none of that: it's already sitting on rows get_my_conversations /
 * get_my_favorites / get_profile_detail fetch anyway.
 *
 * The reciprocal "if you don't share, you don't see" rule is enforced
 * server-side now (those RPCs null out the timestamp unless both sides have
 * show_online_status on) since there's no channel-join left to piggyback it
 * on — see supabase/migrations/20260808090000_last_seen_presence.sql.
 *
 * Mount exactly once, high in the tree (AppShell).
 */
export function useLastSeenHeartbeat(myProfileId: string | undefined, shareEnabled: boolean) {
  useEffect(() => {
    if (!myProfileId || !shareEnabled) return;

    async function touch() {
      await supabase
        .from("profiles")
        .update({ last_seen_at: new Date().toISOString() })
        .eq("id", myProfileId!);
    }

    let intervalId: ReturnType<typeof setInterval> | undefined;

    function start() {
      touch();
      intervalId = setInterval(touch, HEARTBEAT_INTERVAL_MS);
    }

    function stop() {
      if (intervalId) clearInterval(intervalId);
      intervalId = undefined;
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") start();
      else stop();
    }

    if (document.visibilityState === "visible") start();
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      stop();
    };
  }, [myProfileId, shareEnabled]);
}

/**
 * "online" | "offline" | undefined (undefined = show no badge at all).
 * lastSeenAt is whatever the RPC returned for the *other* profile — already
 * null server-side unless both parties have show_online_status on, so no
 * privacy logic is needed here, just a recency check. Re-evaluates itself
 * every 30s so a badge flips to "offline" as the window elapses while the
 * page stays open, without needing a subscription of any kind.
 */
export function usePresenceStatus(
  lastSeenAt: string | null | undefined
): "online" | "offline" | undefined {
  const [, forceTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => forceTick((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  if (!lastSeenAt) return undefined;
  return Date.now() - new Date(lastSeenAt).getTime() < ONLINE_THRESHOLD_MS ? "online" : "offline";
}
