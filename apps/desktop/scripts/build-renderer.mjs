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

await build({ entryPoints: ["renderer/onboarding.ts"], outfile: "dist/onboarding-renderer.js", bundle: true, platform: "browser", format: "iife", target: "chrome144" });
await copyFile("renderer/onboarding.html", "dist/onboarding.html");
await copyFile("renderer/onboarding.css", "dist/onboarding.css");
await copyFile("build/icons/icon-mac.png", "dist/onboarding-logo.png");
