import { useAdminAuditLog } from "~/lib/queries/useAdmin";

export default function AdminAuditLog() {
  const { data: entries, isLoading } = useAdminAuditLog();

  return (
    <div>
      <h1 className="text-lg font-semibold">Journal d'audit</h1>
      <p className="mt-1 text-sm text-muted">
        Les 100 dernières actions de modération, en lecture seule.
      </p>

      <div className="mt-4 overflow-x-auto rounded-2xl border border-line">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs text-muted">
              <th className="px-3 py-2 font-medium">Date</th>
              <th className="px-3 py-2 font-medium">Action</th>
              <th className="px-3 py-2 font-medium">Cible</th>
              <th className="px-3 py-2 font-medium">Admin</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={4} className="px-3 py-4 text-center text-muted">
                  Chargement…
                </td>
              </tr>
            )}
            {entries?.length === 0 && (
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
                <td className="px-3 py-2 font-medium">{entry.action}</td>
                <td className="px-3 py-2 text-muted">
                  {entry.target_type} · {entry.target_id.slice(0, 8)}…
                </td>
                <td className="px-3 py-2 text-muted">
                  {entry.admin_user_id.slice(0, 8)}…
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
