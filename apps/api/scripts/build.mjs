// Bundles the API into a single dist/server.js.
//
// `tsc` alone can't produce something runnable: @rencontre/shared is consumed
// as TypeScript source (its exports point at src/*.ts, which Vite and tsx read
// directly), so a plain `node dist/server.js` failed with ERR_MODULE_NOT_FOUND
// the moment it imported it. Bundling inlines that workspace package and
// leaves every real npm dependency external — they're installed next to the
// artifact like any other Node service.
import { readFileSync } from "node:fs";
import { build } from "esbuild";

const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const external = Object.keys(pkg.dependencies)
  .filter((name) => name !== "@rencontre/shared")
  .flatMap((name) => [name, `${name}/*`]);

await build({
  entryPoints: ["src/server.ts"],
  outfile: "dist/server.js",
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  sourcemap: true,
  external,
  logLevel: "info",
});
