import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// Merge Tailwind classes with later ones winning conflicts, so a component's
// internal classes can always be overridden by a caller's `className` without
// depending on stylesheet order. Every primitive in components/ui uses this.
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
