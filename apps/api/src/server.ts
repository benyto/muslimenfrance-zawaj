import { env } from "./env.js";
import { buildApp } from "./app.js";
import { startMaintenance } from "./lib/maintenance.js";

const app = await buildApp();

try {
  await app.listen({ port: env.PORT, host: "0.0.0.0" });
  startMaintenance(app.log);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
