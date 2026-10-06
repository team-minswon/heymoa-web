import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { ImageResponse } from "next/og";

import { siteConfig } from "@/lib/site";

/** 상단 바 · 푸터 · 파비콘과 같은 앵무새 마크. 요청과 상관없는 값이라 모듈에서 한 번만 읽는다(Node 런타임). */
const LOGO = `data:image/png;base64,${await readFile(join(process.cwd(), "public/apple-touch-icon.png"), "base64")}`;
export const alt = `${siteConfig.name} — 회의에서 받아 적던 손, 이제 쉬어도 됩니다`;
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

/**
 * 공유 카드. **랜딩 첫 화면을 줄여 옮겼다** — 흰 바탕에 뜬 라벤더 판, 히어로 제목, 「쉬어도」의 노란
 * 형광펜. 링크를 받은 사람이 카드와 첫 화면에서 같은 말을 본다. 아래 한 줄은 제목이 말하지 않은 것(근거와
 * 함께 정리)만 쓴다 — 「회의 · 받아 적」을 되풀이하지 않는다. 옛 「참여형 AI 회의 운영 에이전트」는 APP-934
 * 에서 내렸다.
 *
 * - 색은 `components/heymoa/landing/tokens.ts` 의 `TV_VARS` 값을 직접 적는다 — `ImageResponse` 는 CSS
 *   변수를 모르는 별도 렌더러다. 랜딩 토큰이 바뀌면 여기도 같이 고친다.
 * - 형광펜은 `MARKER` 와 같은 띠(글자 높이 0.42em, 줄 아래쪽)를 절대 배치 상자로 그린다. 상자를 글자보다
 *   먼저 두어야 글자가 위에 칠해진다(z-index 가 없다).
 * - 한글은 `next/og` 가 Google Fonts 에서 Noto Sans KR 을 쓰인 글자만큼 받아 온다(`fonts` 를 안 넘기는
 *   이유). 굵기는 400 하나라 히어로의 extrabold 는 못 낸다 — 그래서 크기로 무게를 낸다.
 * - 로고는 `public/apple-touch-icon.png` 를 data URL 로 넣는다(Next 문서 「Using Node.js runtime with local
 *   assets」). 그래서 edge 런타임을 쓰지 않는다.
 */
export default function Image() {
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
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            fontSize: 34,
            letterSpacing: -1,
          }}
        >
          <img src={LOGO} alt="" width={52} height={52} style={{ borderRadius: 999 }} />
          {siteConfig.name}
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          {/* 줄은 랜딩처럼 「…손, / 이제 쉬어도 됩니다」로만 가른다. 92px 에서 첫 줄이 약 870px 라 판 안(1008)에 든다. */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              fontSize: 92,
              lineHeight: 1.12,
              letterSpacing: -3.5,
            }}
          >
            <div style={{ display: "flex" }}>회의에서 받아 적던 손,</div>
            <div style={{ display: "flex", gap: 22 }}>
              <span>이제</span>
              <div style={{ display: "flex", position: "relative" }}>
                <div
                  style={{
                    position: "absolute",
                    left: -8,
                    right: -8,
                    bottom: 8,
                    height: 39,
                    background: "#ffd23f",
                  }}
                />
                <span>쉬어도</span>
              </div>
              <span>됩니다</span>
            </div>
          </div>
          <div
            style={{
              marginTop: 28,
              fontSize: 30,
              lineHeight: 1.45,
              color: "#433f69",
            }}
          >
            결정과 할 일은 근거와 함께 정리해 둡니다.
          </div>
        </div>
      </div>
    </div>,
    size
  );
}
