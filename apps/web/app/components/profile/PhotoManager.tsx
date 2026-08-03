import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { useUploadThing, authHeaders } from "~/lib/uploadthing";
import { usePhotos, useInvalidatePhotos, photoUrl } from "~/lib/queries/usePhotos";
import { useDeletePhoto } from "~/lib/queries/useDeletePhoto";

const MAX_PHOTOS = 10;

const statusLabels: Record<string, { label: string; className: string }> = {
  pending: { label: "En vérification", className: "bg-warning-soft text-warning" },
  approved: { label: "Publiée", className: "bg-success-soft text-success" },
  rejected: { label: "Refusée", className: "bg-danger-soft text-danger" },
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
    <div className="rounded-2xl border border-line bg-raised p-6 shadow-sm">
      <h3 className="mb-4 text-base font-semibold">Photos</h3>

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {photos?.map((photo) => {
          const status = statusLabels[photo.moderation_status];
          return (
            <div key={photo.id} className="group relative aspect-square overflow-hidden rounded-xl bg-sunken">
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
            isDragActive ? "border-primary bg-primary-soft" : "border-line"
          }`}
        >
          <input {...getInputProps()} />
          {isUploading ? "Envoi en cours..." : `Glissez des photos ici, ou cliquez pour en choisir (${remaining} restantes, 4 Mo max)`}
        </div>
      )}

      {uploadError && <p className="mt-2 text-sm text-danger">{uploadError}</p>}
    </div>
  );
}
