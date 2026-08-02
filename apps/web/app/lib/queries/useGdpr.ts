import { useMutation } from "@tanstack/react-query";
import { apiFetch } from "~/lib/api-client";

export function useExportData() {
  return useMutation({
    mutationFn: async () => apiFetch("/gdpr/export", { method: "POST", body: "{}" }),
    onSuccess: (data) => {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `rencontre-mes-donnees-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);
    },
  });
}

export function useDeleteAccount() {
  return useMutation({
    mutationFn: async () => apiFetch("/gdpr/delete", { method: "POST", body: "{}" }),
  });
}
