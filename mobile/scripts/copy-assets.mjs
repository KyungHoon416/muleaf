import { cp, mkdir } from "node:fs/promises";
const target = new URL("../dist/", import.meta.url);
await mkdir(new URL("audio/", target), { recursive: true });
for (const name of ["art", "brand", "favicon.svg", "googlea51952951171d7b6.html", "audio/ocean-preview.mp3", "audio/glass-preview.mp3"]) {
  await cp(new URL(`../../public/${name}`, import.meta.url), new URL(name, target), { recursive: true });
}
// Original full-length audio must not be distributed in a public bundle.
