import { useState } from "react";
import { useAdminPhotos, useModeratePhoto, type AdminPhotoRow } from "~/lib/queries/useAdmin";
import { photoUrl } from "~/lib/queries/usePhotos";

const statusFilters = [
  { value: "pending", label: "En attente" },
  { value: "approved", label: "Approuvées" },
  { value: "rejected", label: "Rejetées" },
  { value: "all", label: "Toutes" },
] as const;

export default function AdminPhotos() {
  const [status, setStatus] = useState<(typeof statusFilters)[number]["value"]>("pending");
  const { data: photos, isLoading } = useAdminPhotos(status);

  return (
    <div>
      <div className="flex flex-wrap gap-1">
        {statusFilters.map((f) => (
          <button
            key={f.value}
            onClick={() => setStatus(f.value)}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              status === f.value
                ? "bg-primary text-on-primary"
                : "bg-sunken text-muted"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {isLoading && <p className="text-sm text-muted">Chargement…</p>}
        {photos?.length === 0 && <p className="text-sm text-muted">Aucune photo.</p>}
        {photos?.map((photo) => <PhotoCard key={photo.id} photo={photo} />)}
      </div>
    </div>
  );
}

function PhotoCard({ photo }: { photo: AdminPhotoRow }) {
  const moderate = useModeratePhoto();

  return (
    <div className="overflow-hidden rounded-2xl border border-line">
      <div className="aspect-square w-full overflow-hidden bg-sunken">
        <img src={photoUrl(photo.uploadthing_key)} alt="" className="h-full w-full object-cover" />
      </div>
      <div className="p-3">
        <p className="text-sm font-medium">{photo.profiles?.nickname ?? "—"}</p>
        <p className="text-xs text-muted">{photo.moderation_status}</p>
        {photo.moderation_status === "pending" && (
          <div className="mt-2 flex gap-2">
            <button
              onClick={() => moderate.mutate({ id: photo.id, status: "approved" })}
              disabled={moderate.isPending}
              className="flex-1 rounded-xl bg-success px-2 py-1.5 text-xs font-medium text-white disabled:opacity-60"
            >
              Approuver
            </button>
            <button
              onClick={() => moderate.mutate({ id: photo.id, status: "rejected" })}
              disabled={moderate.isPending}
              className="flex-1 rounded-xl bg-danger px-2 py-1.5 text-xs font-medium text-white disabled:opacity-60"
            >
              Rejeter
            </button>
          </div>
        )}
        {moderate.isError && <p className="mt-1 text-xs text-danger">{(moderate.error as Error).message}</p>}
      </div>
    </div>
  );
}
