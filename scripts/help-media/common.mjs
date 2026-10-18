/**
 * 가이드 이미지·영상 파이프라인의 공통부 (APP-1236). 시험이 아니다 — CI 에 넣지 않는다.
 *
 * 쓰는 법: 목 모드 dev 서버를 띄운 채 `pnpm help:shots` · `pnpm help:clips`.
 *   NEXT_PUBLIC_API_MOCKING=enabled pnpm dev --port 4200
 *   HELP_BASE=http://localhost:4200 pnpm help:shots
 * 화면은 **가이드 전용 목 프리셋**(`lib/mocks/help-demo`)으로만 찍는다 — 브라우저 localStorage 의
 * `heymoa:helpDemo=1` 이 켠다(아래 `openDemo`). 운영 서버는 건드리지 않는다.
 *
 * 이미지는 `sharp`(Next 가 이미 의존)로 줄여 WebP 로, 영상은 `ffmpeg` 로 WebM(VP9) + MP4(H.264) + poster WebP 로 만든다.
 */
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

export const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../.."
);
export const BASE = process.env.HELP_BASE ?? "http://localhost:4200";
// 점검용: HELP_OUT 을 주면 그 폴더에만 쓰고 목록(manifest)은 건드리지 않는다.
export const DRY = Boolean(process.env.HELP_OUT);
export const OUT = process.env.HELP_OUT ?? path.join(ROOT, "public/help");
export const MANIFEST = path.join(ROOT, "lib/help/media-manifest.ts");
export const FFMPEG = process.env.FFMPEG ?? "/opt/homebrew/bin/ffmpeg";
export const FFPROBE = process.env.FFPROBE ?? "/opt/homebrew/bin/ffprobe";

const require = createRequire(import.meta.url);
// pnpm 은 sharp 를 최상위에 두지 않는다 — Next 가 의존하는 것을 Next 기준으로 푼다.
export const sharp = createRequire(require.resolve("next/package.json"))(
  "sharp"
);
export const { chromium } = await import(
  path.join(ROOT, "node_modules/@playwright/test/index.mjs")
);

export const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** 이미지·영상의 크기를 모아 `lib/help/media-manifest.ts` 로 쓴다(컴포넌트가 width·height 를 여기서 읽는다). */
const loadManifest = () => {
  if (!existsSync(MANIFEST)) return {};
  const match = readFileSync(MANIFEST, "utf8").match(
    /= (\{[\s\S]*\}) as const/
  );
  // prettier 가 따옴표를 바꿔 놓을 수 있어 JSON 이 아니라 객체 리터럴로 읽는다(우리가 쓴 파일이다)
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
    `// 자동 생성: \`pnpm help:shots\` · \`pnpm help:clips\` 가 쓴다. 손으로 고치지 않는다.\nexport const HELP_MEDIA = ${JSON.stringify(sorted, null, 2)} as const;\n`
  );
}

/** 가이드용 목 프리셋이 켜진 컨텍스트. */
export async function openDemo(
  browser,
  { width = 1280, height = 800, scale = 2, video } = {}
) {
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: scale,
    colorScheme: "light",
    locale: "ko-KR",
    timezoneId: "Asia/Seoul",
    ...(video
      ? { recordVideo: { dir: video.dir, size: { width, height } } }
      : {}),
  });
  const demo = process.env.HELP_DEMO !== "0";
  await context.addInitScript((enabled) => {
    if (enabled) localStorage.setItem("heymoa:helpDemo", "1");
  }, demo);
  // 개발 서버의 Next 표시(왼쪽 아래 N)를 지운다 — 가이드 화면에 개발 도구가 보이면 안 된다.
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
  // 서버가 그리는 첫 화면의 사용자 이름도 프리셋 값으로 맞춘다(`lib/auth/server.ts` 의 목 분기가 이 쿠키를 읽는다)
  if (demo)
    await context.addCookies([
      { name: "heymoa-help-demo", value: "1", url: BASE },
    ]);
  const page = await context.newPage();
  return { context, page };
}

/** 강조 링: 보라 토큰의 얇은 링을 요소 둘레에 겹쳐 그린다. 레이아웃을 바꾸지 않는다(position:fixed). */
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

/**
 * 화면을 찍어 WebP 로 저장한다. `target` 은 Locator 또는 `{x,y,width,height}` 클립. 가로 최대 1200px(2x 로 찍어 줄임),
 * 장당 200KB 안팎을 목표로 품질을 낮춰 가며 맞춘다.
 */
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
