import { useState } from "react";
import { reportReasons } from "@rencontre/shared";
import { useCreateReport } from "~/lib/queries/useCreateReport";

const reasonLabels: Record<string, string> = {
  spam: "Spam",
  inappropriate: "Contenu inapproprié",
  harassment: "Harcèlement",
  fake: "Faux profil",
  violence: "Violence",
  hate_speech: "Discours haineux",
  other: "Autre",
};

export function ReportForm({ profileId, onDone }: { profileId: string; onDone: () => void }) {
  const [reason, setReason] = useState<string>("");
  const [description, setDescription] = useState("");
  const createReport = useCreateReport();

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!reason) return;
    createReport.mutate(
      { contentType: "profile", contentId: profileId, reason: reason as (typeof reportReasons)[number], description },
      { onSuccess: onDone }
    );
  }

  return (
    <form onSubmit={submit} className="mt-3 flex flex-col gap-3 rounded-xl border border-line p-4">
      <select
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        required
        className="rounded-xl border border-line bg-raised px-3 py-2 text-sm"
      >
        <option value="">Motif du signalement</option>
        {reportReasons.map((r) => (
          <option key={r} value={r}>
            {reasonLabels[r]}
          </option>
        ))}
      </select>
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Détails (optionnel)"
        rows={3}
        className="rounded-xl border border-line bg-raised px-3 py-2 text-sm"
      />
      {createReport.isError && <p className="text-sm text-danger">{(createReport.error as Error).message}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={createReport.isPending}
          className="rounded-xl bg-danger px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {createReport.isPending ? "Envoi..." : "Envoyer le signalement"}
        </button>
        <button type="button" onClick={onDone} className="rounded-xl px-4 py-2 text-sm text-muted">
          Annuler
        </button>
      </div>
    </form>
  );
}
