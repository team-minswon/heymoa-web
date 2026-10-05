import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

if (process.platform !== "darwin") throw new Error("Regenerate committed icons on macOS (sips/iconutil)");
const icons = fileURLToPath(new URL("../build/icons/", import.meta.url));
const assets = fileURLToPath(new URL("../assets/", import.meta.url));
const scratch = mkdtempSync(join(tmpdir(), "heymoa-icons-"));
function run(command, args) {
  const result = spawnSync(command, args, { encoding: "utf8" });
  if (result.status !== 0) throw new Error(result.stderr || `${command} failed`);
}
try {
  run("sips", ["-z", "1024", "1024", join(icons, "source.png"), "--out", join(icons, "icon.png")]);
  run("sips", ["-z", "1024", "1024", join(icons, "source-mac.png"), "--out", join(icons, "icon-mac.png")]);
  for (const scale of [1, 2]) {
    const output = join(assets, `trayTemplate${scale === 2 ? "@2x" : ""}.png`);
    run("sips", ["-z", String(20 * scale), String(20 * scale), join(icons, "tray-source.png"), "--out", output]);
  }
  const iconset = join(scratch, "icon.iconset");
  run("mkdir", [iconset]);
  for (const size of [16, 32, 128, 256, 512]) {
    for (const scale of [1, 2]) {
      run("sips", ["-z", String(size * scale), String(size * scale), join(icons, "icon-mac.png"), "--out", join(iconset, `icon_${size}x${size}${scale === 2 ? "@2x" : ""}.png`)]);
    }
  }
  run("iconutil", ["-c", "icns", iconset, "-o", join(icons, "icon.icns")]);
  const sizes = [16, 24, 32, 48, 64, 128, 256];
  const pngs = sizes.map((size) => {
    const output = join(scratch, `${size}.png`);
    run("sips", ["-z", String(size), String(size), join(icons, "icon.png"), "--out", output]);
    return readFileSync(output);
  });
  const directory = Buffer.alloc(6 + sizes.length * 16);
  directory.writeUInt16LE(1, 2);
  directory.writeUInt16LE(sizes.length, 4);
  let offset = directory.length;
  sizes.forEach((size, index) => {
    const entry = 6 + index * 16;
    directory[entry] = size === 256 ? 0 : size;
    directory[entry + 1] = directory[entry];
    directory.writeUInt16LE(1, entry + 4);
    directory.writeUInt16LE(32, entry + 6);
    directory.writeUInt32LE(pngs[index].length, entry + 8);
    directory.writeUInt32LE(offset, entry + 12);
    offset += pngs[index].length;
  });
  writeFileSync(join(icons, "icon.ico"), Buffer.concat([directory, ...pngs]));
} finally {
  rmSync(scratch, { recursive: true, force: true });
}
