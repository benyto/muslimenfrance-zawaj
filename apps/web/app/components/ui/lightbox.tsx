import { useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { ChevronLeft, ChevronRight, Maximize, Minimize, X } from "lucide-react";
import { cn } from "~/lib/cn";

/**
 * Full-screen photo viewer with prev/next navigation and a real Fullscreen
 * API toggle (distinct from the dialog itself already covering the
 * viewport — "fullscreen" here means the browser chrome gets out of the
 * way too, useful on a phone where the address bar otherwise eats ~10% of
 * the screen).
 */
export function PhotoLightbox({
  photos,
  index,
  onIndexChange,
  open,
  onOpenChange,
}: {
  photos: string[];
  index: number;
  onIndexChange: (index: number) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const hasMultiple = photos.length > 1;

  function goPrev() {
    onIndexChange((index - 1 + photos.length) % photos.length);
  }
  function goNext() {
    onIndexChange((index + 1) % photos.length);
  }

  useEffect(() => {
    if (!open || !hasMultiple) return;
    function handleKey(event: KeyboardEvent) {
      if (event.key === "ArrowLeft") goPrev();
      if (event.key === "ArrowRight") goNext();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, index, photos.length]);

  // Tracks the real fullscreen state rather than trusting our own toggle —
  // the user can also leave fullscreen via Escape, F11 or the browser's own
  // UI, none of which go through toggleFullscreen().
  useEffect(() => {
    function handleChange() {
      setIsFullscreen(!!document.fullscreenElement);
    }
    document.addEventListener("fullscreenchange", handleChange);
    return () => document.removeEventListener("fullscreenchange", handleChange);
  }, []);

  useEffect(() => {
    if (!open && document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
  }, [open]);

  function toggleFullscreen() {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      document.documentElement.requestFullscreen().catch(() => {});
    }
  }

  if (photos.length === 0) return null;

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="anim-fade fixed inset-0 z-50 bg-black/90" />
        <Dialog.Content
          className="anim-fade fixed inset-0 z-50 flex flex-col items-center justify-center outline-none"
          onClick={(event) => {
            if (event.target === event.currentTarget) onOpenChange(false);
          }}
        >
          <Dialog.Title className="sr-only">
            Photo {index + 1} sur {photos.length}
          </Dialog.Title>

          <div className="absolute right-4 top-4 flex gap-2">
            <button
              type="button"
              onClick={toggleFullscreen}
              aria-label={isFullscreen ? "Quitter le plein écran" : "Plein écran"}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-black/40 text-white hover:bg-black/60"
            >
              {isFullscreen ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
            </button>
            <Dialog.Close asChild>
              <button
                type="button"
                aria-label="Fermer"
                className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-black/40 text-white hover:bg-black/60"
              >
                <X className="h-5 w-5" />
              </button>
            </Dialog.Close>
          </div>

          {hasMultiple && (
            <button
              type="button"
              onClick={goPrev}
              aria-label="Photo précédente"
              className="absolute left-2 top-1/2 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white hover:bg-black/60 sm:left-4"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
          )}

          <img
            src={photos[index]}
            alt={`Photo ${index + 1} sur ${photos.length}`}
            className="max-h-[85dvh] max-w-[92vw] rounded-lg object-contain"
          />

          {hasMultiple && (
            <button
              type="button"
              onClick={goNext}
              aria-label="Photo suivante"
              className="absolute right-2 top-1/2 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white hover:bg-black/60 sm:right-4"
            >
              <ChevronRight className="h-6 w-6" />
            </button>
          )}

          {hasMultiple && (
            <div className="absolute bottom-6 flex gap-1.5">
              {photos.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => onIndexChange(i)}
                  aria-label={`Aller à la photo ${i + 1}`}
                  aria-current={i === index}
                  className={cn(
                    "h-1.5 w-1.5 rounded-full transition-colors",
                    i === index ? "bg-white" : "bg-white/40 hover:bg-white/70"
                  )}
                />
              ))}
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
