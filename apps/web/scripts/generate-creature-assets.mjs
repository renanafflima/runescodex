import { readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const files = readdirSync(join(root, "public/images/creatures")).filter((file) =>
  file.toLowerCase().endsWith(".gif"),
);

function creatureImageKey(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[^a-z0-9]+/g, "");
}

const map = {};
for (const file of files) {
  const key = creatureImageKey(file);
  if (!map[key]) map[key] = file;
}

const entries = Object.entries(map)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([key, file]) => `  ${JSON.stringify(key)}: ${JSON.stringify(file)},`)
  .join("\n");

writeFileSync(
  join(root, "src/domain/creature-assets.ts"),
  `export const CREATURE_FILE_BY_KEY: Record<string, string> = {\n${entries}\n};\n`,
);

console.log(`Wrote ${Object.keys(map).length} creature keys`);
