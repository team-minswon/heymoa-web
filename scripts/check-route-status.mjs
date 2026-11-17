#!/usr/bin/env node
const origin = process.argv[2] ?? "http://localhost:3143";

const CASES = [
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
  { path: "/meta.json", status: 404, type: "text/html", text: "Page not found" },
  ...[
    "/ko/help/situations/record-call-audio/opengraph-image-1a2b3c",
    "/en/help/start/opengraph-image-1a2b3c",
    "/ko/download/opengraph-image-9f8e",
  ].map((path) => ({ path, status: 301, location: "/opengraph-image.png" })),
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
