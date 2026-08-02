import { useMutation, useQuery } from "@tanstack/react-query";
import { supabase } from "~/lib/supabase-client";
import { apiFetch } from "~/lib/api-client";
import { useMyProfile } from "~/lib/queries/useMyProfile";

// The only enabled product applicable to the caller's gender (or 'all'), if
// any — RLS ("subscription_products select enabled") already limits this to
// enabled=true rows, so an empty result means the paywall is currently off
// for this user (the free-launch toggle from the project plan).
export function useAvailableSubscriptionProduct() {
  const { data: profile } = useMyProfile();

  return useQuery({
    queryKey: ["subscription-product", profile?.gender],
    enabled: !!profile,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subscription_products")
        .select("*")
        .eq("enabled", true)
        .or(`audience.eq.all,audience.eq.${profile!.gender}`)
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useMySubscription() {
  return useQuery({
    queryKey: ["my-subscription"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_subscriptions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useStartCheckout() {
  return useMutation({
    mutationFn: async () =>
      apiFetch("/stripe/checkout", { method: "POST", body: "{}" }) as Promise<{ url: string }>,
    onSuccess: (data) => {
      if (data.url) window.location.href = data.url;
    },
  });
}

export function useOpenBillingPortal() {
  return useMutation({
    mutationFn: async () =>
      apiFetch("/stripe/portal", { method: "POST", body: "{}" }) as Promise<{ url: string }>,
    onSuccess: (data) => {
      if (data.url) window.location.href = data.url;
    },
  });
}
