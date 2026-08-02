import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Database } from "@rencontre/shared";
import { supabase } from "~/lib/supabase-client";
import { apiFetch } from "~/lib/api-client";

type ProfileModerationStatus = "pending" | "approved" | "rejected" | "disabled";
type PhotoModerationStatus = "pending" | "approved" | "rejected";
type ReportStatus = "pending" | "reviewed" | "resolved" | "dismissed";

// Reads go direct from the admin's own session — RLS's "* admin all" /
// "admin select" policies already grant full access once is_admin_or_moderator()
// is true, so there's no need to route reads through the API.

export function useAdminProfiles(status: ProfileModerationStatus | "all") {
  return useQuery({
    queryKey: ["admin-profiles", status],
    queryFn: async () => {
      let query = supabase.from("profiles").select("*").order("created_at", { ascending: false });
      if (status !== "all") query = query.eq("moderation_status", status);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });
}

export function useModerateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: { id: string; status: ProfileModerationStatus; notes?: string }) =>
      apiFetch(`/admin/profiles/${params.id}/moderate`, {
        method: "POST",
        body: JSON.stringify({ status: params.status, notes: params.notes }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-profiles"] });
      queryClient.invalidateQueries({ queryKey: ["admin-counts"] });
    },
  });
}

export function useAdminPhotos(status: PhotoModerationStatus | "all") {
  return useQuery({
    queryKey: ["admin-photos", status],
    queryFn: async () => {
      let query = supabase
        .from("profile_photos")
        .select("*, profiles(nickname)")
        .order("created_at", { ascending: false });
      if (status !== "all") query = query.eq("moderation_status", status);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });
}

export function useModeratePhoto() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: { id: string; status: PhotoModerationStatus }) =>
      apiFetch(`/admin/photos/${params.id}/moderate`, {
        method: "POST",
        body: JSON.stringify({ status: params.status }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-photos"] });
      queryClient.invalidateQueries({ queryKey: ["admin-counts"] });
    },
  });
}

export function useAdminReports(status: ReportStatus | "all") {
  return useQuery({
    queryKey: ["admin-reports", status],
    queryFn: async () => {
      let query = supabase.from("reports").select("*").order("created_at", { ascending: false });
      if (status !== "all") query = query.eq("status", status);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });
}

export function useResolveReport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: { id: string; status: "resolved" | "dismissed"; adminNotes?: string }) =>
      apiFetch(`/admin/reports/${params.id}/resolve`, {
        method: "POST",
        body: JSON.stringify({ status: params.status, adminNotes: params.adminNotes }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-reports"] });
      queryClient.invalidateQueries({ queryKey: ["admin-counts"] });
    },
  });
}

export function useAdminSubscriptionProducts() {
  return useQuery({
    queryKey: ["admin-subscription-products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subscription_products")
        .select("*")
        .order("audience");
      if (error) throw error;
      return data;
    },
  });
}

type SubscriptionProductInput = {
  audience: "all" | "male" | "female";
  name: string;
  stripeProductId?: string | null;
  stripePriceId?: string | null;
  priceAmount?: number | null;
  currency?: string;
  interval?: string;
  trialPeriodDays?: number;
  enabled?: boolean;
};

export function useCreateSubscriptionProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: SubscriptionProductInput) =>
      apiFetch("/admin/subscription-products", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-subscription-products"] }),
  });
}

export function useUpdateSubscriptionProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: Partial<SubscriptionProductInput> & { id: string }) =>
      apiFetch(`/admin/subscription-products/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-subscription-products"] }),
  });
}

export function useAdminAuditLog() {
  return useQuery({
    queryKey: ["admin-audit-log"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("admin_audit_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
  });
}

export function useAdminCounts() {
  return useQuery({
    queryKey: ["admin-counts"],
    queryFn: async () => {
      const [pendingProfiles, pendingPhotos, pendingReports, totalProfiles] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }).eq("moderation_status", "pending"),
        supabase.from("profile_photos").select("id", { count: "exact", head: true }).eq("moderation_status", "pending"),
        supabase.from("reports").select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("profiles").select("id", { count: "exact", head: true }),
      ]);
      return {
        pendingProfiles: pendingProfiles.count ?? 0,
        pendingPhotos: pendingPhotos.count ?? 0,
        pendingReports: pendingReports.count ?? 0,
        totalProfiles: totalProfiles.count ?? 0,
      };
    },
  });
}

export type AdminProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
export type AdminPhotoRow = Database["public"]["Tables"]["profile_photos"]["Row"] & {
  profiles: { nickname: string } | null;
};
export type AdminReportRow = Database["public"]["Tables"]["reports"]["Row"];
export type AdminSubscriptionProductRow = Database["public"]["Tables"]["subscription_products"]["Row"];
export type AdminAuditLogRow = Database["public"]["Tables"]["admin_audit_log"]["Row"];
