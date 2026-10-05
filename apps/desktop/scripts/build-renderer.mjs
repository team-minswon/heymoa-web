import { build } from "esbuild";
import { copyFile } from "node:fs/promises";
import path from "node:path";
await build({
  entryPoints: ["renderer/capture.ts"],
  outfile: "dist/capture-renderer.js",
  bundle: true,
  platform: "browser",
  format: "iife",
  target: "chrome144",
  alias: { "@": path.resolve("../..") },
});
await copyFile("renderer/capture.html", "dist/capture.html");
await copyFile(
  "../../public/pcm-capture-worklet.js",
  "dist/pcm-capture-worklet.js"
);
