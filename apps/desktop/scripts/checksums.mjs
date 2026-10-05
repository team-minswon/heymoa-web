import { createHash } from "node:crypto";
import { createReadStream, readdirSync, statSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
const directory = process.argv[2] ? resolve(process.argv[2]) : fileURLToPath(new URL("../release/", import.meta.url));
const files = readdirSync(directory).filter((file) => /^HeyMoa-[\w.-]+\.(?:dmg|zip|exe)$/.test(file) && statSync(join(directory, file)).isFile()).sort();
if (!files.length) throw new Error("No installer assets to checksum");
const lines = [];
for (const file of files) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(join(directory, file))) hash.update(chunk);
  lines.push(`${hash.digest("hex")}  ${basename(file)}`);
  console.log(`${file}: ${statSync(join(directory, file)).size} bytes`);
}
writeFileSync(join(directory, "SHA256SUMS"), `${lines.join("\n")}\n`);
