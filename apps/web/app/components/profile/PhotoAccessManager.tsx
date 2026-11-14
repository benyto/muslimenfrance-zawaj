import { useMyPhotoAccess, useSetPhotoAccess } from "~/lib/queries/usePhotoAccess";
import { usePhotoUrl } from "~/lib/photo-urls";
import { Avatar, Card } from "~/components/ui/primitives";
import { Button } from "~/components/ui/button";

type AccessRowData = { viewer_profile_id: string; nickname: string | null; photo_key: string | null };

// Its own component because the avatar needs a hook (signed photo URL), which
// can't be called from inside a .map() callback.
function AccessRow({ row, actions }: { row: AccessRowData; actions: React.ReactNode }) {
  const photo = usePhotoUrl(row.photo_key, "thumb");
  return (
    <li className="flex items-center justify-between gap-3 rounded-xl border border-line px-3 py-2">
      <span className="flex min-w-0 items-center gap-3">
        <Avatar src={photo ?? null} name={row.nickname ?? "?"} size="sm" />
        <span className="truncate text-sm text-ink">{row.nickname}</span>
      </span>
      <span className="flex shrink-0 items-center gap-2">{actions}</span>
    </li>
  );
}

// Owner-side management of who may see their private photos. Renders
// nothing until there's at least one request or grant — a permanent empty
// card would just be noise for the many members who never use private
// photos. Granting without a request is possible from the chat header.
export function PhotoAccessManager() {
  const { data: rows } = useMyPhotoAccess();
  const setAccess = useSetPhotoAccess();

  const pending = rows?.filter((r) => r.status === "pending") ?? [];
  const granted = rows?.filter((r) => r.status === "granted") ?? [];
  if (pending.length === 0 && granted.length === 0) return null;

  const respond = (viewerProfileId: string, grant: boolean) =>
    setAccess.mutate({ viewerProfileId, grant });

  return (
    <Card className="p-6">
      <h3 className="text-base font-semibold">Accès à vos photos privées</h3>

      {pending.length > 0 && (
        <div className="mt-4">
          <h4 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">
            Demandes en attente
          </h4>
          <ul className="flex flex-col gap-2">
            {pending.map((row) => (
              <AccessRow
                key={row.viewer_profile_id}
                row={row}
                actions={
                  <>
                    <Button
                      size="sm"
                      onClick={() => respond(row.viewer_profile_id, true)}
                      disabled={setAccess.isPending}
                    >
                      Autoriser
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => respond(row.viewer_profile_id, false)}
                      disabled={setAccess.isPending}
                    >
                      Refuser
                    </Button>
                  </>
                }
              />
            ))}
          </ul>
        </div>
      )}

      {granted.length > 0 && (
        <div className="mt-4">
          <h4 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">
            Membres autorisés
          </h4>
          <ul className="flex flex-col gap-2">
            {granted.map((row) => (
              <AccessRow
                key={row.viewer_profile_id}
                row={row}
                actions={
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => respond(row.viewer_profile_id, false)}
                    disabled={setAccess.isPending}
                  >
                    Retirer l&apos;accès
                  </Button>
                }
              />
            ))}
          </ul>
        </div>
      )}

      {setAccess.isError && (
        <p className="mt-3 text-sm text-danger">{(setAccess.error as Error).message}</p>
      )}
    </Card>
  );
}
