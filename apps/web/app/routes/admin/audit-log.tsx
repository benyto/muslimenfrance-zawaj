import { useState } from "react";
import { useAdminAuditLog } from "~/lib/queries/useAdmin";
import { AdminProfileDetailSheet } from "~/components/admin/AdminProfileDetailSheet";
import { Skeleton } from "~/components/ui/primitives";

export default function AdminAuditLog() {
  const { data: entries, isLoading } = useAdminAuditLog();
  const [viewProfileId, setViewProfileId] = useState<string | null>(null);

  return (
    <div>
      <h1 className="font-serif text-2xl text-ink">Journal d&apos;audit</h1>
      <p className="mt-1 text-sm text-muted">
        Les 100 dernières actions de modération, en lecture seule.
      </p>

      <div className="mt-4 overflow-x-auto rounded-2xl border border-line">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line bg-sunken text-left text-xs text-muted">
              <th className="px-3 py-2 font-medium">Date</th>
              <th className="px-3 py-2 font-medium">Action</th>
              <th className="px-3 py-2 font-medium">Cible</th>
              <th className="px-3 py-2 font-medium">Admin</th>
            </tr>
          </thead>
          <tbody>
            {isLoading &&
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b border-line last:border-0">
                  <td colSpan={4} className="px-3 py-3">
                    <Skeleton className="h-4 w-full" />
                  </td>
                </tr>
              ))}
            {!isLoading && entries?.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-4 text-center text-muted">
                  Aucune entrée.
                </td>
              </tr>
            )}
            {entries?.map((entry) => (
              <tr key={entry.id} className="border-b border-line last:border-0">
                <td className="whitespace-nowrap px-3 py-2 text-muted">
                  {new Date(entry.created_at).toLocaleString("fr-FR")}
                </td>
                <td className="px-3 py-2 font-medium text-ink">{entry.action}</td>
                <td className="px-3 py-2 text-muted">
                  {entry.target_type === "profile" ? (
                    <button
                      type="button"
                      onClick={() => setViewProfileId(entry.target_id)}
                      className="font-medium text-primary hover:underline"
                    >
                      profile · {entry.target_id.slice(0, 8)}…
                    </button>
                  ) : (
                    <>
                      {entry.target_type} · {entry.target_id.slice(0, 8)}…
                    </>
                  )}
                </td>
                <td className="px-3 py-2 text-muted">{entry.admin_user_id.slice(0, 8)}…</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <AdminProfileDetailSheet profileId={viewProfileId} onOpenChange={(open) => !open && setViewProfileId(null)} />
    </div>
  );
}
