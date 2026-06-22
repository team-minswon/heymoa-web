import { ImageResponse } from "next/og";

import { siteConfig } from "@/lib/site";

export const runtime = "edge";
export const alt = "진짜그림 AI 일러스트 검사 서비스";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        background: "#fffaf0",
        color: "#0a0a0a",
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
            background: "#0a0a0a",
            color: "#ffffff",
          }}
        >
          眞
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
          AI 일러스트 검사와 이미지 판별
        </div>
        <div
          style={{
            maxWidth: 880,
            fontSize: 30,
            lineHeight: 1.45,
            color: "#3a3a3a",
          }}
        >
          AI 생성 일러스트, 공모전 출품 이미지, 메타데이터 신호를 함께
          분석합니다.
        </div>
      </div>
    </div>,
    size
  );
}
