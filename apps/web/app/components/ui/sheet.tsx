import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "~/lib/cn";
import { Button, IconButton } from "./button";

/**
 * Bottom sheet on mobile, right-hand panel from `sm` up. Radix handles the
 * focus trap, focus restore, Escape and scroll lock — none of which the app's
 * previous overlay-free UI had.
 *
 * @radix-ui/react-dialog was already a dependency and had never been imported.
 */
export function Sheet({
  open,
  onOpenChange,
  title,
  description,
  footer,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  footer?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="anim-fade fixed inset-0 z-40 bg-ink/40 backdrop-blur-sm" />
        <Dialog.Content
          className={cn(
            "fixed z-50 flex flex-col bg-surface shadow-2xl",
            "anim-rise sm:anim-slide-in",
            // mobile: bottom sheet, capped so the page stays visible behind
            "inset-x-0 bottom-0 max-h-[85dvh] rounded-t-3xl",
            // >= sm: full-height right panel
            "sm:inset-y-0 sm:left-auto sm:right-0 sm:max-h-none sm:w-[26rem] sm:rounded-none sm:rounded-l-3xl"
          )}
        >
          <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
            <div className="min-w-0">
              <Dialog.Title className="font-serif text-lg text-ink">{title}</Dialog.Title>
              {description && (
                <Dialog.Description className="mt-0.5 text-sm text-muted">
                  {description}
                </Dialog.Description>
              )}
            </div>
            <Dialog.Close asChild>
              <IconButton label="Fermer" size="sm">
                <X className="h-4 w-4" />
              </IconButton>
            </Dialog.Close>
          </div>

          <div
            className="flex-1 overflow-y-auto px-5 py-5"
            style={{ paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))" }}
          >
            {children}
          </div>

          {footer && (
            <div
              className="border-t border-line bg-raised px-5 py-4"
              style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
            >
              {footer}
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/**
 * Replaces the two native `confirm()` calls — one of which permanently
 * deletes a member's account — with a styled, focus-trapped dialog.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirmer",
  cancelLabel = "Annuler",
  destructive = false,
  loading = false,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  loading?: boolean;
  onConfirm: () => void;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="anim-fade fixed inset-0 z-40 bg-ink/40 backdrop-blur-sm" />
        <Dialog.Content className="anim-rise fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-line bg-raised p-6 shadow-2xl">
          <Dialog.Title className="font-serif text-lg text-ink">{title}</Dialog.Title>
          <Dialog.Description className="mt-2 text-sm text-muted">
            {description}
          </Dialog.Description>
          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Dialog.Close asChild>
              <Button variant="secondary">{cancelLabel}</Button>
            </Dialog.Close>
            <Button
              variant={destructive ? "danger" : "primary"}
              loading={loading}
              onClick={onConfirm}
            >
              {confirmLabel}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
