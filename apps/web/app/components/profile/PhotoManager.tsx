import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { Globe, Lock, Trash2 } from "lucide-react";
import { useUploadThing, authHeaders } from "~/lib/uploadthing";
import { usePhotos, useInvalidatePhotos, useSetPhotoVisibility, photoUrl } from "~/lib/queries/usePhotos";
import { useDeletePhoto } from "~/lib/queries/useDeletePhoto";
import { cn } from "~/lib/cn";
import { ConfirmDialog } from "~/components/ui/sheet";

const MAX_PHOTOS = 10;

const statusLabels: Record<string, { label: string; className: string }> = {
  pending: { label: "En vérification", className: "bg-warning-soft text-warning" },
  approved: { label: "Publiée", className: "bg-success-soft text-success" },
  rejected: { label: "Refusée", className: "bg-danger-soft text-danger" },
};

// A two-option switch rather than a single chip: the old chip showed the
// *current* state ("Publique") but looked like a label, so it wasn't obvious
// it could be pressed or what pressing it would do. Both choices are always
// on screen and the active one is filled.
function VisibilitySwitch({
  value,
  onChange,
  disabled,
}: {
  value: "public" | "private";
  onChange: (value: "public" | "private") => void;
  disabled: boolean;
}) {
  const options = [
    { value: "public", label: "Publique", Icon: Globe },
    { value: "private", label: "Privée", Icon: Lock },
  ] as const;

  return (
    <div
      role="radiogroup"
      aria-label="Visibilité de la photo"
      className="mt-2 grid grid-cols-2 gap-0.5 rounded-lg border border-line-strong bg-sunken p-0.5"
    >
      {options.map(({ value: optionValue, label, Icon }) => {
        const selected = value === optionValue;
        return (
          <button
            key={optionValue}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            onClick={() => !selected && onChange(optionValue)}
            className={cn(
              "flex min-h-9 items-center justify-center gap-1 rounded-md text-xs font-medium transition-colors disabled:opacity-60",
              selected ? "bg-primary text-on-primary shadow-sm" : "text-muted hover:bg-raised hover:text-ink"
            )}
          >
            <Icon className="h-3.5 w-3.5" aria-hidden="true" />
            {label}
          </button>
        );
      })}
    </div>
  );
}

export function PhotoManager({ profileId }: { profileId: string }) {
  const { data: photos } = usePhotos(profileId);
  const invalidatePhotos = useInvalidatePhotos();
  const deletePhoto = useDeletePhoto(profileId);
  const setVisibility = useSetPhotoVisibility(profileId);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [photoToDelete, setPhotoToDelete] = useState<string | null>(null);

  const { startUpload, isUploading } = useUploadThing("profileDatingPhotos", {
    headers: authHeaders,
    onClientUploadComplete: () => {
      setUploadError(null);
      invalidatePhotos(profileId);
    },
    onUploadError: (error) => setUploadError(error.message),
  });

  const remaining = MAX_PHOTOS - (photos?.length ?? 0);

  const onDrop = useCallback(
    (accepted: File[]) => {
      if (accepted.length === 0) return;
      startUpload(accepted.slice(0, remaining));
    },
    [startUpload, remaining]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/*": [] },
    maxSize: 4 * 1024 * 1024,
    disabled: isUploading || remaining <= 0,
  });

  return (
    <div className="rounded-2xl border border-line bg-raised p-6 shadow-sm">
      <h3 className="text-base font-semibold">Photos</h3>
      <ul className="mb-4 mt-1 space-y-1 text-sm text-muted">
        <li>
          <span className="font-medium text-ink">Publique</span> : visible de tous les membres, une fois la
          photo validée.
        </li>
        <li>
          <span className="font-medium text-ink">Privée</span> : visible uniquement des membres que vous
          autorisez.
        </li>
        <li>Les nouvelles photos sont privées par défaut. Les changements sont enregistrés immédiatement.</li>
      </ul>

      {photos && photos.length > 0 && !photos.some((p) => p.visibility === "public") && (
        <p className="mb-4 rounded-xl bg-warning-soft p-3 text-sm text-warning">
          Aucune de vos photos n&apos;est publique : les autres membres ne verront pas de photo de vous tant
          que vous n&apos;en rendez pas au moins une publique.
        </p>
      )}

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {photos?.map((photo) => {
          const status = statusLabels[photo.moderation_status];
          const isPrivate = photo.visibility === "private";
          return (
            <div key={photo.id}>
              <div className="group relative aspect-square overflow-hidden rounded-xl bg-sunken">
                <img src={photoUrl(photo.uploadthing_key)} alt="" className="h-full w-full object-cover" />
                {status && (
                  <span className={`absolute left-1 top-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${status.className}`}>
                    {status.label}
                  </span>
                )}
                {/* Always visible (not hover-only) so it works on touch; the
                    deletion itself is confirmed because it also removes the
                    file from storage and can't be undone. */}
                <button
                  type="button"
                  onClick={() => setPhotoToDelete(photo.id)}
                  className="absolute right-1 top-1 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white transition-colors hover:bg-danger"
                  aria-label="Supprimer la photo"
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
              <VisibilitySwitch
                value={isPrivate ? "private" : "public"}
                onChange={(visibility) => setVisibility.mutate({ photoId: photo.id, visibility })}
                disabled={setVisibility.isPending}
              />
            </div>
          );
        })}
      </div>

      {remaining > 0 && (
        <div
          {...getRootProps()}
          className={`cursor-pointer rounded-xl border-2 border-dashed p-6 text-center text-sm transition-colors ${
            isDragActive ? "border-primary bg-primary-soft" : "border-line"
          }`}
        >
          <input {...getInputProps()} />
          {isUploading ? "Envoi en cours..." : `Glissez des photos ici, ou cliquez pour en choisir (${remaining} restantes, 4 Mo max)`}
        </div>
      )}

      {uploadError && <p className="mt-2 text-sm text-danger">{uploadError}</p>}
      {deletePhoto.isError && (
        <p className="mt-2 text-sm text-danger">
          La photo n&apos;a pas pu être supprimée : {(deletePhoto.error as Error).message}
        </p>
      )}

      <ConfirmDialog
        open={photoToDelete !== null}
        onOpenChange={(open) => !open && setPhotoToDelete(null)}
        title="Supprimer cette photo ?"
        description="La photo sera définitivement supprimée. Cette action est irréversible."
        confirmLabel="Supprimer"
        destructive
        loading={deletePhoto.isPending}
        onConfirm={() => {
          if (!photoToDelete) return;
          deletePhoto.mutate(photoToDelete, { onSettled: () => setPhotoToDelete(null) });
        }}
      />
    </div>
  );
}
