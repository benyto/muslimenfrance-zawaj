import { useQueries, useQuery } from "@tanstack/react-query";
import { supabase } from "~/lib/supabase-client";
import { cn } from "~/lib/cn";

// Photos live in a private Storage bucket, so an image can only be shown with
// a short-lived signed URL — and Storage only signs an object the caller's
// SELECT policy lets them read (see can_read_photo_object). That makes access
// a database decision: a path someone shouldn't have is useless to them, and
// withdrawing access stops new URLs from being issued.
//
// What the RPCs return as a "photo key" is "<profile_id>/<photo_id>"; each
// photo is two objects under it.
export type PhotoVariant = "thumb" | "display";

const BUCKET = "profile-photos";
// How long a link keeps working once handed out. It is a bearer URL, so this is
// also roughly how long someone who already has one can still load a photo
// after it is deleted or their access is withdrawn (new links are refused at
// once): Storage serves the photo with an Expires equal to this lifetime, so
// browsers and the CDN may keep it that long. Keep PHOTO_CACHE_SECONDS in the
// API's photos/storage.ts equal to it.
const SIGNED_URL_TTL_SECONDS = 10 * 60;
// Refresh well before the URL expires, so a tab left open never hands an
// <img> a dead link.
const REFRESH_MS = 8 * 60_000;

const objectPath = (key: string, variant: PhotoVariant) => `${key}/${variant}.webp`;

// A grid of 24 cards asks for 24 URLs in the same render. They are collected
// for a moment and signed in one request instead of 24.
type Waiting = { path: string; resolve: (url: string) => void; reject: (error: Error) => void };
let queue: Waiting[] = [];
let flushScheduled = false;

async function flush() {
  const batch = queue;
  queue = [];
  flushScheduled = false;

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrls([...new Set(batch.map((w) => w.path))], SIGNED_URL_TTL_SECONDS);

  if (error || !data) {
    for (const w of batch) w.reject(new Error(error?.message ?? "Photo indisponible"));
    return;
  }
  const byPath = new Map(data.map((entry) => [entry.path, entry]));
  for (const w of batch) {
    const entry = byPath.get(w.path);
    if (entry?.signedUrl) w.resolve(entry.signedUrl);
    else w.reject(new Error(entry?.error ?? "Photo indisponible"));
  }
}

function signPath(path: string): Promise<string> {
  return new Promise((resolve, reject) => {
    queue.push({ path, resolve, reject });
    if (!flushScheduled) {
      flushScheduled = true;
      setTimeout(flush, 20);
    }
  });
}

const urlQuery = (key: string, variant: PhotoVariant) => ({
  queryKey: ["photo-url", key, variant] as const,
  queryFn: () => signPath(objectPath(key, variant)),
  staleTime: REFRESH_MS,
  refetchInterval: REFRESH_MS,
  // A refusal means "not yours to see" — retrying won't change that.
  retry: false,
});

/** Signed URL for one photo, or undefined while loading or if it isn't viewable. */
export function usePhotoUrl(key: string | null | undefined, variant: PhotoVariant): string | undefined {
  return useQuery({ ...urlQuery(key ?? "", variant), enabled: !!key }).data;
}

/** One URL per key, in order; undefined entries are still loading or unavailable. */
export function usePhotoUrls(
  keys: readonly string[] | null | undefined,
  variant: PhotoVariant,
  enabled = true
): (string | undefined)[] {
  return useQueries({
    queries: (keys ?? []).map((key) => ({ ...urlQuery(key, variant), enabled })),
    combine: (results) => results.map((r) => r.data),
  });
}

/** An <img> for a stored photo, with a neutral placeholder until its URL arrives. */
export function PhotoImg({
  photoKey,
  variant,
  alt,
  className,
  loading,
}: {
  photoKey: string;
  variant: PhotoVariant;
  alt: string;
  className?: string;
  loading?: "lazy" | "eager";
}) {
  const url = usePhotoUrl(photoKey, variant);
  if (!url) return <div className={cn("animate-pulse bg-sunken", className)} role="img" aria-label={alt} />;
  return <img src={url} alt={alt} loading={loading} className={className} />;
}
