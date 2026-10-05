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
await build({
  entryPoints: ["renderer/meeting.ts"],
  outfile: "dist/meeting-renderer.js",
  bundle: true,
  platform: "browser",
  format: "iife",
  target: "chrome144",
});
await copyFile("renderer/meeting.html", "dist/meeting.html");
await copyFile("renderer/meeting.css", "dist/meeting.css");
await copyFile(
  "../../public/pcm-capture-worklet.js",
  "dist/pcm-capture-worklet.js"
);
