import { createHash } from "node:crypto";
import { createReadStream, existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { parse } from "yaml";

export async function verifyUpdateFeed(directory, version) {
  const feeds = ["latest.yml", "latest-mac.yml"].filter((name) =>
    existsSync(resolve(directory, name))
  );
  if (!feeds.length) throw new Error("Missing update metadata");
  for (const feed of feeds) {
    const info = parse(readFileSync(resolve(directory, feed), "utf8"));
    if (
      info.version !== version ||
      !Array.isArray(info.files) ||
      !info.files.length
    )
      throw new Error(`Invalid update metadata: ${feed}`);
    if (
      feed === "latest-mac.yml" &&
      !info.files.some((file) => file.url.endsWith(".zip"))
    )
      throw new Error("Mac updates require a ZIP");
    for (const file of info.files) {
      if (
        typeof file.url !== "string" ||
        !/^HeyMoa-[\w.-]+\.(?:exe|zip|dmg)$/.test(file.url)
      )
        throw new Error("Invalid update asset path");
      const asset = resolve(directory, file.url);
      if (!existsSync(asset) || statSync(asset).size !== file.size)
        throw new Error(`Missing or wrong-sized update asset: ${file.url}`);
      const hash = createHash("sha512");
      for await (const chunk of createReadStream(asset)) hash.update(chunk);
      if (hash.digest("base64") !== file.sha512)
        throw new Error(`Update checksum mismatch: ${file.url}`);
      if (/\.(?:exe|zip)$/.test(file.url) && !existsSync(asset + ".blockmap"))
        throw new Error(`Missing update blockmap: ${file.url}`);
    }
  }
  return feeds;
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  const version = JSON.parse(
    readFileSync(new URL("../package.json", import.meta.url), "utf8")
  ).version;
  console.log(
    "Verified update feeds:",
    await verifyUpdateFeed(
      resolve(process.argv[2] ?? "apps/desktop/release"),
      version
    )
  );
}
