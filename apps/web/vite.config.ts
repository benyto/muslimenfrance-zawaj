import path from "node:path";
import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [tailwindcss(), reactRouter()],
  optimizeDeps: {
    // Vite normally pre-bundles a dependency only when a page first imports
    // it. Anything first reached later (a route nobody has opened yet, e.g.
    // the chat's emoji picker) triggers a full re-optimization mid-session:
    // every dependency hash changes, in-flight requests come back as
    // "504 Outdated Optimize Dep", and the page goes blank until a manual
    // reload. Listing them here does all of it once at startup. Dev-only —
    // production builds are unaffected. Add new runtime deps here too.
    include: [
      "@hookform/resolvers/zod",
      "@radix-ui/react-dialog",
      "@radix-ui/react-popover",
      "@radix-ui/react-toast",
      "@supabase/supabase-js",
      "@tanstack/react-query",
      "@uploadthing/react",
      "clsx",
      "date-fns",
      "date-fns/locale",
      "lucide-react",
      "react-dropzone",
      "react-hook-form",
      "react-router",
      "tailwind-merge",
      "zod",
    ],
  },
  resolve: {
    // Must mirror the `~/*` path in tsconfig.json — tsc resolves that via
    // tsconfig `paths`, but Rollup's production build needs its own alias.
    alias: {
      "~": path.resolve(import.meta.dirname, "app"),
    },
  },
});
