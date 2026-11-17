import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import {
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
  existsSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { BROWSER_LOCALE, LOCALE } from "./ui.mjs";

export const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../.."
);
export const BASE = process.env.HELP_BASE ?? "http://localhost:4200";
export const DRY = Boolean(process.env.HELP_OUT);
export const OUT =
  process.env.HELP_OUT ?? path.join(ROOT, LOCALE === "en" ? "public/help/en" : "public/help");
export const MANIFEST = path.join(ROOT, LOCALE === "en" ? "lib/help/media-manifest-en.ts" : "lib/help/media-manifest.ts");
const MANIFEST_CONST = LOCALE === "en" ? "HELP_MEDIA_EN" : "HELP_MEDIA";
export const FFMPEG = process.env.FFMPEG ?? "/opt/homebrew/bin/ffmpeg";
export const FFPROBE = process.env.FFPROBE ?? "/opt/homebrew/bin/ffprobe";

const require = createRequire(import.meta.url);
export const sharp = createRequire(require.resolve("next/package.json"))(
  "sharp"
);
export const { chromium } = await import(
  path.join(ROOT, "node_modules/@playwright/test/index.mjs")
);

export const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const loadManifest = () => {
  if (!existsSync(MANIFEST)) return {};
  const match = readFileSync(MANIFEST, "utf8").match(
    /= (\{[\s\S]*\}) as const/
  );
  return match ? new Function(`return ${match[1]}`)() : {};
};
export function record(key, entry) {
  if (DRY) return;
  const manifest = loadManifest();
  manifest[key] = entry;
  const sorted = Object.fromEntries(
    Object.entries(manifest).sort(([a], [b]) => a.localeCompare(b))
  );
  writeFileSync(
    MANIFEST,
    `// 자동 생성: ${LOCALE === "en" ? "\`HELP_LOCALE=en pnpm help:shots\` · \`help:clips\`" : "\`pnpm help:shots\` · \`pnpm help:clips\`"} 가 쓴다. 손으로 고치지 않는다.\nexport const ${MANIFEST_CONST} = ${JSON.stringify(sorted, null, 2)} as const;\n`
  );
}

export async function openDemo(
  browser,
  { width = 1280, height = 800, scale = 2, video } = {}
) {
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: scale,
    colorScheme: "light",
    locale: BROWSER_LOCALE,
    timezoneId: "Asia/Seoul",
    ...(video
      ? { recordVideo: { dir: video.dir, size: { width, height } } }
      : {}),
  });
  const demo = process.env.HELP_DEMO !== "0";
  await context.addInitScript((enabled) => {
    if (enabled) localStorage.setItem("heymoa:helpDemo", "1");
  }, demo);
  await context.addInitScript(() => {
    const hide = () => {
      const style = document.createElement("style");
      style.textContent = "nextjs-portal{display:none!important}";
      document.documentElement.append(style);
    };
    if (document.readyState === "loading")
      addEventListener("DOMContentLoaded", hide);
    else hide();
  });
  if (demo)
    await context.addCookies([
      { name: "heymoa-help-demo", value: "1", url: BASE },
    ]);
  await context.addCookies(languageCookies(BASE));
  const page = await context.newPage();
  return { context, page };
}

export async function ring(page, locator, { pad = 4 } = {}) {
  const box = await locator.boundingBox();
  if (!box) throw new Error("ring: 요소를 찾지 못했습니다");
  await page.evaluate(
    ({ box, pad }) => {
      const el = document.createElement("div");
      el.setAttribute("data-help-ring", "");
      Object.assign(el.style, {
        position: "fixed",
        left: `${box.x - pad}px`,
        top: `${box.y - pad}px`,
        width: `${box.width + pad * 2}px`,
        height: `${box.height + pad * 2}px`,
        border: "2px solid #5a3df0",
        borderRadius: "10px",
        boxShadow: "0 0 0 4px rgba(90,61,240,0.18)",
        pointerEvents: "none",
        zIndex: "2147483647",
      });
      document.body.append(el);
    },
    { box, pad }
  );
}
export const clearRings = (page) =>
  page.evaluate(() =>
    document.querySelectorAll("[data-help-ring]").forEach((el) => el.remove())
  );

export async function shoot(
  page,
  target,
  key,
  { maxWidth = 1200, budget = 200 * 1024, pad = 0 } = {}
) {
  let png;
  if (typeof target.boundingBox === "function") {
    if (pad > 0) {
      const box = await target.boundingBox();
      const view = page.viewportSize();
      const x = Math.max(0, box.x - pad);
      const y = Math.max(0, box.y - pad);
      png = await page.screenshot({
        clip: {
          x,
          y,
          width: Math.min(view.width - x, box.width + pad * 2),
          height: Math.min(view.height - y, box.height + pad * 2),
        },
        animations: "disabled",
      });
    } else png = await target.screenshot({ animations: "disabled" });
  } else png = await page.screenshot({ clip: target, animations: "disabled" });
  const file = path.join(OUT, `${key}.webp`);
  mkdirSync(path.dirname(file), { recursive: true });
  let quality = 82;
  let info;
  for (;;) {
    info = await sharp(png)
      .resize({ width: maxWidth, withoutEnlargement: true })
      .webp({ quality, effort: 5 })
      .toFile(file);
    if (statSync(file).size <= budget || quality <= 50) break;
    quality -= 6;
  }
  record(`${key}.webp`, {
    width: info.width,
    height: info.height,
    bytes: info.size,
  });
  console.log(
    `  ${key}.webp  ${info.width}x${info.height}  ${(info.size / 1024).toFixed(0)}KB`
  );
  return info;
}

export const run = (cmd, args) =>
  execFileSync(cmd, args, { stdio: ["ignore", "ignore", "pipe"] });

export const languageCookies = (base) => [
  { name: "heymoa-lang", value: LOCALE, url: base },
  ...(LOCALE === "en" ? [{ name: "heymoa-mock-account-lang", value: "en", url: base }] : []),
];
