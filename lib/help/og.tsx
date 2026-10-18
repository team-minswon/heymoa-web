import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { ImageResponse } from "next/og";

import { siteConfig } from "@/lib/site";

const LOGO = `data:image/png;base64,${await readFile(join(process.cwd(), "public/apple-touch-icon.png"), "base64")}`;

export const helpOgSize = { width: 1200, height: 630 };

/**
 * 가이드 공유 카드 — 사이트 카드(`app/opengraph-image.tsx`)와 같은 흰 바탕 · 라벤더 판에 제목과 요약을 얹는다. 색은 `TV_VARS`
 * 값을 직접 적는다(`ImageResponse` 는 CSS 변수를 모른다). 두 표기(HeyMoa · 헤이모아)가 모두 들어간다.
 */
export function helpOgImage(title: string, summary: string) {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        background: "#ffffff",
        padding: 24,
        fontFamily: "sans-serif",
      }}
    >
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#ece8ff",
          borderRadius: 40,
          padding: "56px 72px 64px",
          color: "#1c1845",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 34, letterSpacing: -1 }}>
          <img src={LOGO} alt="" width={52} height={52} style={{ borderRadius: 999 }} />
          {siteConfig.name} · 헤이모아 사용법
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: title.length > 18 ? 68 : 88, lineHeight: 1.15, letterSpacing: -3 }}>
            {title}
          </div>
          <div style={{ display: "flex", marginTop: 28, fontSize: 30, lineHeight: 1.45, color: "#433f69" }}>
            {summary}
          </div>
        </div>
      </div>
    </div>,
    helpOgSize
  );
}
