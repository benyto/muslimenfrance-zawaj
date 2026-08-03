import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outputDir = path.join(__dirname, "..", ".output");
if (!existsSync(outputDir)) mkdirSync(outputDir, { recursive: true });

export function writeOutput(name: string, data: unknown) {
  const file = path.join(outputDir, `${name}.json`);
  writeFileSync(file, JSON.stringify(data, null, 2));
  console.log(`wrote ${file}`);
}

export function readOutput<T>(name: string): T {
  const file = path.join(outputDir, `${name}.json`);
  if (!existsSync(file)) {
    throw new Error(`${file} does not exist — run the earlier step first`);
  }
  return JSON.parse(readFileSync(file, "utf8"));
}
