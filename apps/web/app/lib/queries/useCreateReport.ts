import { useMutation } from "@tanstack/react-query";
import type { CreateReportInput } from "@rencontre/shared";
import { supabase } from "~/lib/supabase-client";

export function useCreateReport() {
  return useMutation({
    mutationFn: async (input: CreateReportInput) => {
      const { data: sessionData } = await supabase.auth.getSession();
      const reporterId = sessionData.session?.user.id;
      if (!reporterId) throw new Error("Not authenticated");

      const { error } = await supabase.from("reports").insert({
        reporter_id: reporterId,
        content_type: input.contentType,
        content_id: input.contentId,
        reason: input.reason,
        description: input.description ?? null,
      });
      if (error) throw error;
    },
  });
}
