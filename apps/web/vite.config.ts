import path from "node:path";
import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [tailwindcss(), reactRouter()],
  resolve: {
    // Must mirror the `~/*` path in tsconfig.json — tsc resolves that via
    // tsconfig `paths`, but Rollup's production build needs its own alias.
    alias: {
      "~": path.resolve(import.meta.dirname, "app"),
    },
  },
});
