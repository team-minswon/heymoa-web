import { ImageResponse } from "next/og";

import { siteConfig } from "@/lib/site";

export const runtime = "edge";
export const alt = "HeyMoa AI 회의 운영 에이전트";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

/**
 * 공유 카드. **색만 랜딩에 맞췄다** — 문구는 `siteConfig`가 정하는 사이트 전체의 설명이라
 * 그대로 둔다.
 *
 * 원래 민트(`#f0fdf4`)에 초록 타일(`#16a34a`)이었는데, 그 값은 이 저장소 어디에도 안 남은
 * 옛 방향이다(`#16a34a`는 `--el-success`로만 살아 있고 그건 의미색이지 브랜드색이 아니다).
 * 링크를 받은 사람이 크림 면으로 들어오는데 카드만 민트면 첫인상이 어긋난다.
 *
 * `--lp-*`를 못 쓰는 자리다 — `ImageResponse`는 CSS 변수를 모르는 별도 렌더러라 값을 직접
 * 적는다. 랜딩 토큰이 바뀌면 여기도 같이 고친다.
 */
export default function Image() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        background: "#faf8f5",
        color: "#33231a",
        padding: 72,
        fontFamily: "sans-serif",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 24,
          fontSize: 34,
          fontWeight: 700,
        }}
      >
        <div
          style={{
            width: 72,
            height: 72,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 18,
            background: "#2e1f17",
            color: "#f6efe6",
          }}
        >
          H
        </div>
        {siteConfig.name}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
        <div
          style={{
            maxWidth: 900,
            fontSize: 72,
            lineHeight: 1.12,
            fontWeight: 500,
            letterSpacing: -3,
          }}
        >
          참여형 AI 회의 운영 에이전트
        </div>
        <div
          style={{
            maxWidth: 880,
            fontSize: 30,
            lineHeight: 1.45,
            color: "#57493f",
          }}
        >
          회의 중 함께 듣고, 맥락을 정리하며, 실행 가능한 액션 아이템으로
          구조화하여 대화를 실제 업무로 연결합니다.
        </div>
      </div>
    </div>,
    size
  );
}
