import { useState } from "react";
import { useAdminPhotos, useModeratePhoto, type AdminPhotoRow } from "~/lib/queries/useAdmin";
import { photoUrl } from "~/lib/queries/usePhotos";
import { PhotoLightbox } from "~/components/ui/lightbox";
import { Badge, Chip, EmptyState, Skeleton } from "~/components/ui/primitives";
import { Button } from "~/components/ui/button";

const statusFilters = [
  { value: "pending", label: "En attente" },
  { value: "approved", label: "Approuvées" },
  { value: "rejected", label: "Rejetées" },
  { value: "all", label: "Toutes" },
] as const;

const statusTone: Record<string, "warning" | "success" | "danger"> = {
  pending: "warning",
  approved: "success",
  rejected: "danger",
};

export default function AdminPhotos() {
  const [status, setStatus] = useState<(typeof statusFilters)[number]["value"]>("pending");
  const { data: photos, isLoading } = useAdminPhotos(status);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const photoUrls = photos?.map((p) => photoUrl(p.uploadthing_key)) ?? [];

  return (
    <div>
      <h1 className="font-serif text-2xl text-ink">Photos</h1>
      <p className="mt-1 text-sm text-muted">Cliquez sur une photo pour la voir en grand.</p>

      <div className="mt-4 flex flex-wrap gap-2">
        {statusFilters.map((f) => (
          <Chip key={f.value} selected={status === f.value} onClick={() => setStatus(f.value)}>
            {f.label}
          </Chip>
        ))}
      </div>

      {isLoading && (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="aspect-square w-full rounded-2xl" />
          ))}
        </div>
      )}
      {!isLoading && photos?.length === 0 && (
        <div className="mt-4 rounded-2xl border border-line">
          <EmptyState title="Aucune photo" description="Rien à afficher pour ce filtre." />
        </div>
      )}
      {!isLoading && photos && photos.length > 0 && (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {photos.map((photo, i) => (
            <PhotoCard key={photo.id} photo={photo} onView={() => setLightboxIndex(i)} />
          ))}
        </div>
      )}

      <PhotoLightbox
        photos={photoUrls}
        index={lightboxIndex ?? 0}
        onIndexChange={setLightboxIndex}
        open={lightboxIndex !== null}
        onOpenChange={(open) => !open && setLightboxIndex(null)}
      />
    </div>
  );
}

function PhotoCard({ photo, onView }: { photo: AdminPhotoRow; onView: () => void }) {
  const moderate = useModeratePhoto();

  return (
    <div className="overflow-hidden rounded-2xl border border-line">
      <button type="button" onClick={onView} className="block aspect-square w-full overflow-hidden bg-sunken">
        <img src={photoUrl(photo.uploadthing_key)} alt="" className="h-full w-full object-cover" />
      </button>
      <div className="p-3">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-sm font-medium text-ink">{photo.profiles?.nickname ?? "—"}</p>
          <Badge tone={statusTone[photo.moderation_status]}>{photo.moderation_status}</Badge>
        </div>
        {photo.moderation_status === "pending" && (
          <div className="mt-2 flex gap-2">
            <Button
              variant="primary"
              size="sm"
              className="flex-1"
              loading={moderate.isPending}
              onClick={() => moderate.mutate({ id: photo.id, status: "approved" })}
            >
              Approuver
            </Button>
            <Button
              variant="danger"
              size="sm"
              className="flex-1"
              disabled={moderate.isPending}
              onClick={() => moderate.mutate({ id: photo.id, status: "rejected" })}
            >
              Rejeter
            </Button>
          </div>
        )}
        {moderate.isError && <p className="mt-1 text-xs text-danger">{(moderate.error as Error).message}</p>}
      </div>
    </div>
  );
}
