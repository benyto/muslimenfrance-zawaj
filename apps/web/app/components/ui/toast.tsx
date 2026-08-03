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

const toneStyles: Record<ToastTone, { icon: typeof Info; className: string }> = {
  success: { icon: CircleCheck, className: "text-success" },
  error: { icon: CircleAlert, className: "text-danger" },
  info: { icon: Info, className: "text-primary" },
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
          const { icon: Icon, className } = toneStyles[item.tone];
          return (
            <ToastPrimitive.Root
              key={item.id}
              onOpenChange={(open) =>
                !open && setItems((prev) => prev.filter((i) => i.id !== item.id))
              }
              className="anim-rise flex items-start gap-3 rounded-xl border border-line bg-raised p-4 shadow-lg"
            >
              <Icon className={cn("mt-0.5 h-5 w-5 shrink-0", className)} aria-hidden="true" />
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
          className="fixed inset-x-0 bottom-0 z-[60] flex w-full flex-col gap-2 p-4 sm:inset-x-auto sm:right-0 sm:max-w-sm"
          style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
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
