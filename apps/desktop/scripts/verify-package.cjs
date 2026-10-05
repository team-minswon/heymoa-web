const fs = require("node:fs");
const path = require("node:path");
const { listPackage } = require("@electron/asar");
const releases = fs
  .readdirSync(path.join(__dirname, "../release"), { withFileTypes: true })
  .filter((item) => item.isDirectory() && /^(?:mac(?:-arm64)?|win-unpacked)$/.test(item.name));
if (!releases.length) throw new Error("No unpacked macOS or Windows package found");
for (const folder of releases) {
  const archive = path.join(
    __dirname,
    "../release",
    folder.name,
    folder.name === "win-unpacked" ? "resources/app.asar" : "HeyMoa.app/Contents/Resources/app.asar"
  );
  const files = listPackage(archive).map((file) => file.replaceAll("\\", "/"));
  const allowed =
    /^\/(?:dist(?:\/(?:(?:main|preload|policy|security|recording-lifecycle|recording-tray|auth|auth-policy|auth-session|media-grant|capture-host|capture-protocol|capture-preload|capture-renderer|pcm-capture-worklet|meeting-timeline|meeting-popover|meeting-preload|meeting-renderer)\.js|(?:capture|meeting)\.html|meeting\.css))?|assets(?:\/(?:trayTemplate(?:@2x)?|tray)\.png)?|package\.json|LICENSE\.txt)$/;
  for (const file of files)
    if (!allowed.test(file))
      throw new Error(`Unexpected packaged file: ${file}`);
  for (const file of [
    "/dist/main.js",
    "/dist/preload.js",
    "/dist/policy.js",
    "/dist/security.js",
    "/dist/recording-lifecycle.js",
    "/dist/recording-tray.js",
    "/dist/auth.js",
    "/dist/auth-policy.js",
    "/dist/auth-session.js",
    "/dist/media-grant.js",
    "/dist/capture-host.js",
    "/dist/capture-protocol.js",
    "/dist/capture-preload.js",
    "/dist/capture-renderer.js",
    "/dist/capture.html",
    "/dist/meeting-timeline.js",
    "/dist/meeting-popover.js",
    "/dist/meeting-preload.js",
    "/dist/meeting-renderer.js",
    "/dist/meeting.html",
    "/dist/meeting.css",
    "/dist/pcm-capture-worklet.js",
    "/package.json",
    "/assets/trayTemplate.png",
    "/assets/trayTemplate@2x.png",
    "/assets/tray.png",
  ])
    if (!files.includes(file)) throw new Error(`Missing file: ${file}`);
  console.log(
    `${folder.name}: allowlist verified; app.asar ${fs.statSync(archive).size} bytes; signing status requires OS verification`
  );
}
