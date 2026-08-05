import { useState } from "react";
import { Eye } from "lucide-react";
import { useAdminReports, useResolveReport, type AdminReportRow } from "~/lib/queries/useAdmin";
import { AdminProfileDetailSheet } from "~/components/admin/AdminProfileDetailSheet";
import { Badge, Card, Chip, EmptyState, Skeleton } from "~/components/ui/primitives";
import { Button } from "~/components/ui/button";
import { Field, Input } from "~/components/ui/form";

const statusFilters = [
  { value: "pending", label: "En attente" },
  { value: "reviewed", label: "Examinés" },
  { value: "resolved", label: "Résolus" },
  { value: "dismissed", label: "Rejetés" },
  { value: "all", label: "Tous" },
] as const;

const statusTone: Record<string, "warning" | "primary" | "success" | "neutral"> = {
  pending: "warning",
  reviewed: "primary",
  resolved: "success",
  dismissed: "neutral",
};

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
  const [viewProfileId, setViewProfileId] = useState<string | null>(null);

  return (
    <div>
      <h1 className="font-serif text-2xl text-ink">Signalements</h1>

      <div className="mt-4 flex flex-wrap gap-2">
        {statusFilters.map((f) => (
          <Chip key={f.value} selected={status === f.value} onClick={() => setStatus(f.value)}>
            {f.label}
          </Chip>
        ))}
      </div>

      <div className="mt-4 flex flex-col gap-3">
        {isLoading &&
          Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28 w-full rounded-2xl" />)}
        {!isLoading && reports?.length === 0 && (
          <Card>
            <EmptyState title="Aucun signalement" description="Rien à afficher pour ce filtre." />
          </Card>
        )}
        {reports?.map((report) => (
          <ReportRow key={report.id} report={report} onViewProfile={() => setViewProfileId(report.content_id)} />
        ))}
      </div>

      <AdminProfileDetailSheet profileId={viewProfileId} onOpenChange={(open) => !open && setViewProfileId(null)} />
    </div>
  );
}

function ReportRow({ report, onViewProfile }: { report: AdminReportRow; onViewProfile: () => void }) {
  const [notes, setNotes] = useState("");
  const resolve = useResolveReport();
  const isActionable = report.status === "pending" || report.status === "reviewed";

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium text-ink">{reasonLabels[report.reason] ?? report.reason}</p>
          <p className="text-xs text-muted">
            {report.content_type === "profile" ? "Profil" : "Message"} · {new Date(report.created_at).toLocaleDateString("fr-FR")}
          </p>
          {report.description && <p className="mt-1 text-sm text-ink">{report.description}</p>}
        </div>
        <Badge tone={statusTone[report.status]} className="shrink-0">
          {report.status}
        </Badge>
      </div>

      {report.content_type === "profile" && (
        <button
          type="button"
          onClick={onViewProfile}
          className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
        >
          <Eye className="h-4 w-4" aria-hidden="true" />
          Voir le profil signalé
        </button>
      )}

      {isActionable && (
        <div className="mt-3 flex flex-col gap-2">
          <Field label="Notes internes (optionnel)">
            {(props) => <Input {...props} value={notes} onChange={(e) => setNotes(e.target.value)} />}
          </Field>
          <div className="flex gap-2">
            <Button
              variant="primary"
              loading={resolve.isPending}
              onClick={() => resolve.mutate({ id: report.id, status: "resolved", adminNotes: notes })}
            >
              Marquer résolu
            </Button>
            <Button
              variant="secondary"
              disabled={resolve.isPending}
              onClick={() => resolve.mutate({ id: report.id, status: "dismissed", adminNotes: notes })}
            >
              Rejeter
            </Button>
          </div>
        </div>
      )}

      {resolve.isError && <p className="mt-2 text-sm text-danger">{(resolve.error as Error).message}</p>}
    </Card>
  );
}
