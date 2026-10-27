import { cp, mkdir, rm } from "node:fs/promises";
import { resolve } from "node:path";

const publishRoot = resolve("render-publish");
const destination = resolve(publishRoot, "runescodex");

await rm(publishRoot, { recursive: true, force: true });
await mkdir(destination, { recursive: true });
await cp(resolve("dist"), destination, { recursive: true });

console.log("Publicação estática pronta em render-publish/runescodex.");
