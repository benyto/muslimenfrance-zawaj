import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { useUploadThing, authHeaders } from "~/lib/uploadthing";
import { usePhotos, useInvalidatePhotos, photoUrl } from "~/lib/queries/usePhotos";
import { useDeletePhoto } from "~/lib/queries/useDeletePhoto";

const MAX_PHOTOS = 10;

const statusLabels: Record<string, { label: string; className: string }> = {
  pending: { label: "En vérification", className: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400" },
  approved: { label: "Publiée", className: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400" },
  rejected: { label: "Refusée", className: "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-400" },
};

export function PhotoManager({ profileId }: { profileId: string }) {
  const { data: photos } = usePhotos(profileId);
  const invalidatePhotos = useInvalidatePhotos();
  const deletePhoto = useDeletePhoto(profileId);
  const [uploadError, setUploadError] = useState<string | null>(null);

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
    <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
      <h3 className="mb-4 text-base font-semibold">Photos</h3>

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {photos?.map((photo) => {
          const status = statusLabels[photo.moderation_status];
          return (
            <div key={photo.id} className="group relative aspect-square overflow-hidden rounded-xl bg-neutral-100 dark:bg-neutral-800">
              <img src={photoUrl(photo.uploadthing_key)} alt="" className="h-full w-full object-cover" />
              {status && (
                <span className={`absolute left-1 top-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${status.className}`}>
                  {status.label}
                </span>
              )}
              <button
                type="button"
                onClick={() => deletePhoto.mutate(photo.id)}
                disabled={deletePhoto.isPending}
                className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-sm text-white opacity-0 transition-opacity group-hover:opacity-100"
                aria-label="Supprimer la photo"
              >
                ×
              </button>
            </div>
          );
        })}
      </div>

      {remaining > 0 && (
        <div
          {...getRootProps()}
          className={`cursor-pointer rounded-xl border-2 border-dashed p-6 text-center text-sm transition-colors ${
            isDragActive ? "border-brand-rose-500 bg-brand-rose-50 dark:bg-neutral-800" : "border-neutral-200 dark:border-neutral-700"
          }`}
        >
          <input {...getInputProps()} />
          {isUploading ? "Envoi en cours..." : `Glissez des photos ici, ou cliquez pour en choisir (${remaining} restantes, 4 Mo max)`}
        </div>
      )}

      {uploadError && <p className="mt-2 text-sm text-red-600">{uploadError}</p>}
    </div>
  );
}
