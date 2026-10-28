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
const serviceWorker = await readFile(resolve(distDirectory, "sw.js"), "utf8");

if (manifest.start_url !== "/runescodex/" || manifest.scope !== "/runescodex/") {
  throw new Error("Manifest sem start_url/scope corretos para /runescodex/.");
}

if (manifest.display !== "standalone") {
  throw new Error("Manifest não está configurado como standalone.");
}

if (!indexHtml.includes("/runescodex/")) {
  throw new Error("Build não contém referências ao base path /runescodex/.");
}

if (indexHtml.includes("/runes/")) {
  throw new Error("Build ainda contém o caminho-base antigo /runes/.");
}

if (
  !serviceWorker.includes("self.skipWaiting()") ||
  !serviceWorker.includes("clientsClaim()")
) {
  throw new Error(
    "Service worker não ativa nem assume clientes automaticamente; o frontend pode permanecer em bundle antigo.",
  );
}

console.log("PWA válida: manifest, service worker e base path /runescodex/ encontrados.");
