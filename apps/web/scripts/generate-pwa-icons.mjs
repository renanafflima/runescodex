import sharp from "sharp";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const source = resolve(root, "public/images/brand/runescodex-icon.png");
const iconsDir = resolve(root, "public/icons");
const bg = { r: 7, g: 11, b: 20, alpha: 1 };

async function squareIcon(size, outfile, innerScale = 1) {
  const inner = Math.round(size * innerScale);
  const logo = await sharp(source)
    .resize(inner, inner, { fit: "contain", background: bg })
    .png()
    .toBuffer();

  await sharp({
    create: { width: size, height: size, channels: 4, background: bg },
  })
    .composite([{ input: logo, gravity: "center" }])
    .png()
    .toFile(resolve(iconsDir, outfile));
}

await squareIcon(192, "icon-192.png");
await squareIcon(512, "icon-512.png");
await squareIcon(512, "maskable-512.png", 0.78);

console.log("PWA PNG icons generated from official brand asset.");