import { useState } from "react";
import { useAdminReports, useResolveReport, type AdminReportRow } from "~/lib/queries/useAdmin";

const statusFilters = [
  { value: "pending", label: "En attente" },
  { value: "reviewed", label: "Examinés" },
  { value: "resolved", label: "Résolus" },
  { value: "dismissed", label: "Rejetés" },
  { value: "all", label: "Tous" },
] as const;

const reasonLabels: Record<string, string> = {
  spam: "Spam",
  inappropriate: "Contenu inapproprié",
  harassment: "Harcèlement",
  fake: "Faux profil",
  violence: "Violence",
  hate_speech: "Discours haineux",
  other: "Autre",
};

export default function AdminReports() {
  const [status, setStatus] = useState<(typeof statusFilters)[number]["value"]>("pending");
  const { data: reports, isLoading } = useAdminReports(status);

  return (
    <div>
      <div className="flex flex-wrap gap-1">
        {statusFilters.map((f) => (
          <button
            key={f.value}
            onClick={() => setStatus(f.value)}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              status === f.value
                ? "bg-brand-rose-500 text-white"
                : "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="mt-4 flex flex-col gap-3">
        {isLoading && <p className="text-sm text-neutral-500">Chargement…</p>}
        {reports?.length === 0 && <p className="text-sm text-neutral-500">Aucun signalement.</p>}
        {reports?.map((report) => <ReportRow key={report.id} report={report} />)}
      </div>
    </div>
  );
}

function ReportRow({ report }: { report: AdminReportRow }) {
  const [notes, setNotes] = useState("");
  const resolve = useResolveReport();

  return (
    <div className="rounded-2xl border border-neutral-200 p-4 dark:border-neutral-800">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium">{reasonLabels[report.reason] ?? report.reason}</p>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            {report.content_type} · {new Date(report.created_at).toLocaleDateString("fr-FR")}
          </p>
          {report.description && <p className="mt-1 text-sm">{report.description}</p>}
        </div>
        <span className="shrink-0 rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400">
          {report.status}
        </span>
      </div>

      {(report.status === "pending" || report.status === "reviewed") && (
        <div className="mt-3 flex flex-col gap-2">
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notes internes (optionnel)"
            className="rounded-xl border border-neutral-200 bg-white px-3 py-1.5 text-sm dark:border-neutral-800 dark:bg-neutral-900"
          />
          <div className="flex gap-2">
            <button
              onClick={() => resolve.mutate({ id: report.id, status: "resolved", adminNotes: notes })}
              disabled={resolve.isPending}
              className="rounded-xl bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60"
            >
              Marquer résolu
            </button>
            <button
              onClick={() => resolve.mutate({ id: report.id, status: "dismissed", adminNotes: notes })}
              disabled={resolve.isPending}
              className="rounded-xl bg-neutral-800 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60 dark:bg-neutral-700"
            >
              Rejeter
            </button>
          </div>
        </div>
      )}

      {resolve.isError && <p className="mt-2 text-sm text-red-600">{(resolve.error as Error).message}</p>}
    </div>
  );
}
