import { useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "~/lib/supabase-client";

// Presence-based typing indicator, scoped per conversation. `notifyTyping`
// is safe to call on every keystroke — internally throttled so it only
// actually broadcasts at most once per 2s, auto-clearing after 3s of
// inactivity.
export function useTypingIndicator(conversationId: string | null | undefined, myProfileId: string | undefined) {
  const [otherIsTyping, setOtherIsTyping] = useState(false);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const lastSentRef = useRef(0);
  const clearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setOtherIsTyping(false);
    if (!conversationId || !myProfileId) return;

    const channel = supabase.channel(`presence:conversation:${conversationId}`, {
      config: { presence: { key: myProfileId } },
    });

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState<{ typing: boolean }>();
        const someoneElseTyping = Object.entries(state).some(
          ([key, presences]) => key !== myProfileId && presences.some((p) => p.typing)
        );
        setOtherIsTyping(someoneElseTyping);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ typing: false });
        }
      });

    channelRef.current = channel;
    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [conversationId, myProfileId]);

  function notifyTyping() {
    const now = Date.now();
    if (now - lastSentRef.current < 2000) return;
    lastSentRef.current = now;
    channelRef.current?.track({ typing: true });

    if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
    clearTimerRef.current = setTimeout(() => channelRef.current?.track({ typing: false }), 3000);
  }

  return { otherIsTyping, notifyTyping };
}
