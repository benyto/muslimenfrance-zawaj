import * as ToastPrimitive from "@radix-ui/react-toast";
import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { CircleAlert, CircleCheck, Info, X } from "lucide-react";
import { cn } from "~/lib/cn";

/**
 * Replaces nine hand-rolled inline error <p> tags scattered across the app,
 * which shifted layout when they appeared and were easy to miss at the bottom
 * of a long form.
 *
 * @radix-ui/react-toast was already a dependency and had never been imported.
 */
type ToastTone = "success" | "error" | "info";

type ToastItem = {
  id: number;
  tone: ToastTone;
  title: string;
  description?: string;
};

type ToastContextValue = {
  toast: (item: Omit<ToastItem, "id">) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const toneStyles: Record<ToastTone, { icon: typeof Info; iconClass: string; borderClass: string }> = {
  success: { icon: CircleCheck, iconClass: "text-success", borderClass: "border-l-success" },
  error: { icon: CircleAlert, iconClass: "text-danger", borderClass: "border-l-danger" },
  info: { icon: Info, iconClass: "text-primary", borderClass: "border-l-primary" },
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const toast = useCallback((item: Omit<ToastItem, "id">) => {
    setItems((prev) => [...prev, { ...item, id: Date.now() + Math.random() }]);
  }, []);

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      <ToastPrimitive.Provider swipeDirection="right" duration={5000}>
        {children}
        {items.map((item) => {
          const { icon: Icon, iconClass, borderClass } = toneStyles[item.tone];
          return (
            <ToastPrimitive.Root
              key={item.id}
              onOpenChange={(open) =>
                !open && setItems((prev) => prev.filter((i) => i.id !== item.id))
              }
              className={cn(
                // anim-drop (Y-axis), not anim-slide-in (X-axis) — this
                // root has swipeDirection="right", and Radix drives that
                // swipe by writing its own inline transform: translateX(…)
                // on mount. A CSS animation also targeting the X axis
                // fights that inline style for the same property and loses
                // partway through — visually a jump into place instead of
                // a slide. Vertical motion doesn't share an axis with the
                // swipe gesture, so nothing to collide with, and it also
                // suits the new top-right resting spot better than the
                // old anim-rise (built for sliding up from the bottom).
                "anim-drop flex items-start gap-3 rounded-xl border border-l-4 border-line bg-raised p-4 shadow-2xl",
                borderClass
              )}
            >
              <Icon className={cn("mt-0.5 h-5 w-5 shrink-0", iconClass)} aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <ToastPrimitive.Title className="text-sm font-medium text-ink">
                  {item.title}
                </ToastPrimitive.Title>
                {item.description && (
                  <ToastPrimitive.Description className="mt-0.5 text-sm text-muted">
                    {item.description}
                  </ToastPrimitive.Description>
                )}
              </div>
              <ToastPrimitive.Close
                aria-label="Fermer"
                className="shrink-0 rounded-md p-1 text-muted hover:bg-sunken hover:text-ink"
              >
                <X className="h-4 w-4" />
              </ToastPrimitive.Close>
            </ToastPrimitive.Root>
          );
        })}
        <ToastPrimitive.Viewport
          className="fixed inset-x-0 top-0 z-[60] flex w-full flex-col gap-2 p-4 sm:inset-x-auto sm:right-0 sm:max-w-sm"
          style={{ paddingTop: "max(1rem, env(safe-area-inset-top))" }}
        />
      </ToastPrimitive.Provider>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used inside ToastProvider");
  return context.toast;
}
