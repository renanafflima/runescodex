import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";

const distDirectory = resolve("dist");
const requiredFiles = [
  "index.html",
  "manifest.webmanifest",
  "sw.js",
  "registerSW.js",
];

await Promise.all(
  requiredFiles.map((file) => access(resolve(distDirectory, file))),
);

const manifest = JSON.parse(
  await readFile(resolve(distDirectory, "manifest.webmanifest"), "utf8"),
);
const indexHtml = await readFile(resolve(distDirectory, "index.html"), "utf8");

if (manifest.start_url !== "/runes/" || manifest.scope !== "/runes/") {
  throw new Error("Manifest sem start_url/scope corretos para /runes/.");
}

if (manifest.display !== "standalone") {
  throw new Error("Manifest não está configurado como standalone.");
}

if (!indexHtml.includes("/runes/")) {
  throw new Error("Build não contém referências ao base path /runes/.");
}

console.log("PWA válida: manifest, service worker e base path /runes/ encontrados.");
