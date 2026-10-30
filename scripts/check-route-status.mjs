#!/usr/bin/env node
/**
 * 운영 빌드의 상태 코드·content-type 확인 (APP-1279).
 *
 *   pnpm build && pnpm start -p 3143 &
 *   node scripts/check-route-status.mjs http://localhost:3143
 *
 * **e2e(`pnpm test:e2e`)는 이것을 대신하지 못한다.** e2e 는 목 모드 dev 서버라 SSR 이 본문을 그리지 않아
 * (`MockProvider`) 없는 주소도 200 이고, 랜딩이 미리 그린 페이지인지 요청 때 그리는 페이지인지도 운영과 다르다.
 * 실제로 운영 빌드에서만 `/없는-주소` 가 500 이었고, 가이드 이미지가 HTML 로 나갔다.
 * API 주소(`NEXT_PUBLIC_API_BASE_URL`)를 넣고 빌드해야 운영과 같다 — 없으면 랜딩이 미리 그린 페이지가 된다.
 */
const origin = process.argv[2] ?? "http://localhost:3143";

const CASES = [
  // 가이드 정적 파일은 한국어 rewrite 를 타지 않는다(`afterFiles`).
  {
    path: "/help/getting-started/new-meeting.webp",
    status: 200,
    type: "image/webp",
  },
  { path: "/help/search-index.json", status: 200, type: "application/json" },
  { path: "/", status: 200, type: "text/html" },
  { path: "/en", status: 200, type: "text/html" },
  { path: "/help/start/desktop", status: 200, type: "text/html" },
  { path: "/download", status: 200, type: "text/html" },
  { path: "/opengraph-image.png", status: 200, type: "image/png" },
  // 없는 주소는 404 다. 언어 접두사가 없으면 쿠키 언어(없으면 한국어), `/en` 아래는 영어.
  ...[
    "/nope",
    "/nope/x",
    "/nope/help",
    "/nope/terms",
    "/help/nope",
    "/help/start/nope",
  ].map((path) => ({
    path,
    status: 404,
    type: "text/html",
    text: "페이지를 찾을 수 없습니다",
  })),
  ...["/en/nope", "/en/help/nope", "/en/w/x"].map((path) => ({
    path,
    status: 404,
    type: "text/html",
    text: "Page not found",
  })),
  // 스캐너 경로도 같은 정적 404 다(APP-1419).
  { path: "/meta.json", status: 404, type: "text/html", text: "Page not found" },
  // 지운 페이지별 공유 이미지는 사이트 공통 그림으로 301(APP-1419).
  ...[
    "/ko/help/situations/record-call-audio/opengraph-image-1a2b3c",
    "/en/help/start/opengraph-image-1a2b3c",
    "/ko/download/opengraph-image-9f8e",
  ].map((path) => ({ path, status: 301, location: "/opengraph-image.png" })),
  // 옛 홈 공유 이미지도 쿼리를 보존해 한 번에 공통 PNG로 이동한다(APP-1468).
  ...["4568eca8368142d7", "4a933a1097fa88c1"].map((hash) => ({
    path: `/opengraph-image?${hash}`,
    status: 301,
    location: `/opengraph-image.png?${hash}`,
  })),
];

let failed = 0;
for (const { path, status, type = "", text, location } of CASES) {
  const response = await fetch(origin + path, { redirect: "manual" });
  const contentType = response.headers.get("content-type") ?? "";
  const body = text ? await response.text() : "";
  const redirected = new URL(response.headers.get("location") ?? "", origin);
  const expected = location ? new URL(location, origin) : null;
  const ok =
    response.status === status &&
    contentType.startsWith(type) &&
    (!expected ||
      (redirected.pathname === expected.pathname &&
        redirected.searchParams.toString() === expected.searchParams.toString())) &&
    (!text || body.includes(text));
  if (!ok) failed++;
  console.log(
    `${ok ? "ok  " : "FAIL"} ${path} → ${response.status} ${contentType}`
  );
}
if (failed) {
  console.error(`${failed} 건이 기대와 다르다.`);
  process.exit(1);
}
