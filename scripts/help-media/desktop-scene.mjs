/**
 * 데스크톱 앱의 메뉴 막대 팝오버를 **실제 렌더러 코드**(`apps/desktop/renderer/meeting.{html,ts,css}`)로 그린다 (APP-1236).
 *
 * macOS 의 메뉴 막대와 팝오버 창은 Playwright 로 찍을 수 없다. 대신 팝오버 안쪽은 웹 페이지(`meeting.html`)라서, 그 파일을
 * 그대로 번들해 iframe 에 올리고 Electron preload 가 주는 `window.heymoaMeeting` 만 가짜로 꽂는다 — 라벨·간격·색이 앱과 같다.
 * 바깥(메뉴 막대·바탕)은 가이드 전용 중립 틀이다(개인 화면·시계·다른 앱 아이콘 없음).
 * **실제 앱을 켜지 않는다.** 운영 계정으로 녹음을 시작하면 운영 DB 에 회의가 생긴다.
 */
import { createRequire } from "node:module";
import { mkdtempSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { ROOT, wait } from "./common.mjs";
import { click } from "./cursor.mjs";

const DESKTOP = path.join(ROOT, "apps/desktop");

async function bundleRenderer() {
  const { build } = createRequire(path.join(DESKTOP, "package.json"))(
    "esbuild"
  );
  const dir = mkdtempSync(path.join(os.tmpdir(), "help-popover-"));
  await build({
    entryPoints: [path.join(DESKTOP, "renderer/meeting.ts")],
    outfile: path.join(dir, "meeting-renderer.js"),
    bundle: true,
    platform: "browser",
    format: "iife",
    target: "chrome120",
    logLevel: "error",
  });
  return dir;
}

const WRAPPER = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><style>
  html,body{margin:0;height:100%;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
  body{background:radial-gradient(1200px 700px at 20% 10%,#ece8ff 0%,rgba(236,232,255,0) 60%),radial-gradient(900px 600px at 90% 90%,#d5f3e6 0%,rgba(213,243,230,0) 60%),#f4f1ff}
  .bar{position:fixed;left:0;right:0;top:0;height:28px;background:rgba(255,255,255,.62);backdrop-filter:blur(14px);border-bottom:1px solid rgba(28,24,69,.08);display:flex;align-items:center;justify-content:flex-end;gap:18px;padding:0 18px;color:#1c1845;font-size:13px}
  .bar .dot{width:14px;height:14px;border-radius:4px;background:rgba(28,24,69,.22)}
  .bar .moa{width:18px;height:18px;border-radius:50%;background:#1c1845;position:relative;display:grid;place-items:center}
  .bar .moa::after{content:"";width:6px;height:6px;border-radius:50%;background:#eb6834;opacity:0;transition:opacity 150ms}
  body.rec .bar .moa::after{opacity:1}
  .bar .moa.on{box-shadow:0 0 0 5px rgba(90,61,240,.18);background:#1c1845}
  .bar .time{font-variant-numeric:tabular-nums;min-width:38px;text-align:right;opacity:0}
  body.rec .bar .time{opacity:1}
  #pop{position:fixed;top:34px;right:46px;width:420px;height:580px;border:0;border-radius:20px;background:#fff;box-shadow:0 0 0 1px rgba(28,24,69,.08),0 24px 60px -12px rgba(28,24,69,.35),0 8px 20px -8px rgba(28,24,69,.2);transform-origin:calc(100% - 28px) 0;transform:scale(.92);opacity:0;pointer-events:none;transition:transform 170ms cubic-bezier(.22,1,.36,1),opacity 140ms ease-out}
  #pop.open{transform:none;opacity:1;pointer-events:auto}
</style></head><body>
  <div class="bar"><span class="dot"></span><span class="dot"></span><span class="time" id="t">0:00</span><span class="moa" id="icon" aria-label="HeyMoa"></span><span class="dot"></span></div>
  <iframe id="pop" src="popover/meeting.html" title="HeyMoa 메뉴 막대 팝오버"></iframe>
  <script>
    window.__view = null; window.__listeners = new Set(); window.__actions = [];
    window.__push = (view) => { window.__view = view; document.body.classList.toggle('rec', !!view && view.canStop && !view.viewing); window.__listeners.forEach((l) => l(view)); };
    window.__toggle = (open) => { document.getElementById('pop').classList.toggle('open', open); document.getElementById('icon').classList.toggle('on', open); };
    window.__setTime = (text) => { document.getElementById('t').textContent = text; };
  </script>
</body></html>`;

const STUB = () => {
  if (!location.pathname.endsWith("/popover/meeting.html")) return;
  const parent = window.parent;
  window.heymoaMeeting = {
    read: async () => parent.__view,
    action: async (action) => {
      parent.__actions.push(action);
    },
    subscribe: (listener) => {
      parent.__listeners.add(listener);
      return () => parent.__listeners.delete(listener);
    },
  };
};

export const IDLE_VIEW = {
  meetings: [],
  viewing: false,
  phase: "idle",
  unknown: false,
  timeline: null,
  label: "녹음 대기",
  elapsed: null,
  warning: null,
  canStop: false,
  stale: false,
};

const NOTE_ID = "01KH000001001";
const mmss = (seconds) =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
const ITEMS = [
  {
    id: "d1",
    tone: "decision",
    label: "결정",
    content: "검색 광고 예산을 지난달보다 늘리고 디스플레이는 줄인다",
    atMs: 38_000,
    citations: [
      { atMs: 36_000, text: "디스플레이는 줄이고 검색 쪽으로 옮기죠." },
    ],
  },
  {
    id: "t1",
    tone: "task",
    label: "할 일",
    content: "성과 리포트 초안을 금요일까지 공유하기",
    atMs: 71_000,
    citations: [
      { atMs: 69_000, text: "리포트 초안은 제가 금요일까지 공유할게요." },
    ],
  },
  {
    id: "o1",
    tone: "open",
    label: "열린 질문",
    content: "랜딩 페이지 문구 시안은 몇 개로 비교할까?",
    atMs: 104_000,
    citations: [
      {
        atMs: 102_000,
        text: "시안을 두 개로 할지 세 개로 할지는 아직 정해야 해요.",
      },
    ],
  },
  {
    id: "r1",
    tone: "reference",
    label: "참고",
    content: "지난 캠페인의 전환율은 3.2%였다",
    atMs: 133_000,
    citations: [],
  },
];
const recording = (seconds, count) => ({
  ...IDLE_VIEW,
  phase: "recording",
  label: "녹음 중",
  elapsed: mmss(seconds),
  canStop: true,
  timeline: {
    noteId: NOTE_ID,
    title: "4월 캠페인 성과 리뷰",
    loading: false,
    failed: false,
    reconnecting: false,
    total: count,
    items: ITEMS.slice(0, count),
  },
});

/**
 * 메뉴 막대 아이콘 → 팝오버 열림 → 녹음 중 실시간 카드가 쌓임 → 탭 고르기 → 녹음 일시정지. 클립 프레임워크(`clips.mjs`)가 요구하는
 * `{ name, path, ready, run }` 꼴을 돌려준다. 가짜 서버 경로 `/__help-media/` 에서 틀과 렌더러 파일을 내준다.
 */
export async function desktopScene(context, base) {
  const dir = await bundleRenderer();
  await context.addInitScript(STUB);
  await context.route(`${base}/__help-media/**`, async (route) => {
    const { pathname } = new URL(route.request().url());
    const file = pathname.replace("/__help-media/", "");
    if (file === "" || file === "index.html")
      return route.fulfill({
        contentType: "text/html; charset=utf-8",
        body: WRAPPER,
      });
    const name = file.replace("popover/", "");
    const source =
      name === "meeting-renderer.js"
        ? path.join(dir, "meeting-renderer.js")
        : path.join(DESKTOP, "renderer", name);
    const type = name.endsWith(".js")
      ? "text/javascript"
      : name.endsWith(".css")
        ? "text/css"
        : "text/html";
    return route.fulfill({
      contentType: `${type}; charset=utf-8`,
      body: readFileSync(source),
    });
  });
  return {
    name: "desktop-menubar",
    path: "/__help-media/index.html",
    ready: (p) => p.frameLocator("#pop").locator("#phase").waitFor(),
    async run(p) {
      const frame = p.frameLocator("#pop");
      const push = (view) => p.evaluate((v) => window.__push(v), view);
      const setTime = (text) => p.evaluate((t) => window.__setTime(t), text);
      await push(IDLE_VIEW);
      await wait(500);
      await click(p, p.locator("#icon"));
      await p.evaluate(() => window.__toggle(true));
      await wait(1100);
      let seconds = 21;
      await push(recording(seconds, 0));
      await setTime(mmss(seconds));
      await wait(900);
      for (let count = 1; count <= 4; count += 1) {
        seconds += 3;
        await push(recording(seconds, count));
        await setTime(mmss(seconds));
        await wait(1000);
      }
      await click(
        p,
        frame.getByRole("button", { name: "열린 질문", exact: true })
      );
      await wait(900);
      await click(p, frame.getByRole("button", { name: "전체", exact: true }));
      await click(p, frame.locator("#stop"));
      await push({
        ...recording(seconds, 4),
        phase: "stopping",
        label: "녹음 일시정지 중",
        canStop: false,
      });
      await wait(700);
      await push({ ...IDLE_VIEW });
      await setTime("0:00");
      await wait(900);
    },
  };
}
