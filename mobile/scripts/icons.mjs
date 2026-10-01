import sharp from "sharp";
import { readFile, writeFile, readdir } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const svg = await readFile(new URL("resources/icon.svg", root), "utf8");
const icon = Buffer.from(svg);
await sharp(icon).resize(1024, 1024).flatten({ background: "#211c2e" }).png()
  .toFile(new URL("ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png", root).pathname);
const foreground = Buffer.from(svg.replace(/<path id="background"[^>]+\/>/, ""));
for (const [density, size] of Object.entries({ mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 })) {
  const base = new URL(`android/app/src/main/res/mipmap-${density}/`, root);
  for (const name of ["ic_launcher.png", "ic_launcher_round.png"]) {
    await sharp(icon).resize(size, size).png().toFile(new URL(name, base).pathname);
  }
  await sharp(foreground).resize(Math.round(size * 2.25), Math.round(size * 2.25)).png()
    .toFile(new URL("ic_launcher_foreground.png", base).pathname);
}
await writeFile(new URL("android/app/src/main/res/values/ic_launcher_background.xml", root),
  '<?xml version="1.0" encoding="utf-8"?>\n<resources><color name="ic_launcher_background">#211c2e</color></resources>\n');
// Replace template splash imagery, keeping each platform's existing dimensions.
for (const base of ["android/app/src/main/res/", "ios/App/App/Assets.xcassets/Splash.imageset/"]) {
  const folder = new URL(base, root);
  const entries = await readdir(folder, { recursive: true });
  for (const entry of entries.filter(name => /splash.*\.png$/i.test(name))) {
    const file = new URL(entry, folder);
    const { width, height } = await sharp(file.pathname).metadata();
    const mark = await sharp(foreground).resize(Math.round(Math.min(width, height) * 0.38)).png().toBuffer();
    const output = await sharp({ create: { width, height, channels: 3, background: "#100f15" } })
      .composite([{ input: mark, gravity: "center" }]).png().toBuffer();
    await writeFile(file, output);
  }
}
