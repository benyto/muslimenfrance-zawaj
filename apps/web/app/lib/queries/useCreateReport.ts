import { useMutation } from "@tanstack/react-query";
import type { CreateReportInput } from "@rencontre/shared";
import { apiFetch } from "~/lib/api-client";

// Routed through the API (not a direct Supabase insert) so the "report
// received" confirmation email can be sent as part of the same request —
// RLS ("reports insert own") still does the actual enforcement either way.
export function useCreateReport() {
  return useMutation({
    mutationFn: async (input: CreateReportInput) =>
      apiFetch("/reports", {
        method: "POST",
        body: JSON.stringify(input),
      }),
  });
}
