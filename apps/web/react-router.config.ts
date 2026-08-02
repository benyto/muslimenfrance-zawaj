import type { Config } from "@react-router/dev/config";

export default {
  // Pure client-side SPA — no server, deployable as static assets to any host.
  ssr: false,
} satisfies Config;
