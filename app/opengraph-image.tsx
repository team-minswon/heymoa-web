import { ImageResponse } from "next/og";

import { siteConfig } from "@/lib/site";

export const runtime = "edge";
export const alt = "HeyMoa AI 회의 운영 에이전트";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#f0fdf4",
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
              background: "#16a34a",
              color: "#ffffff",
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
              color: "#3a3a3a",
            }}
          >
            회의 중 함께 듣고, 맥락을 정리하며, 실행 가능한 액션 아이템으로 구조화하여 대화를 실제 업무로 연결합니다.
          </div>
        </div>
      </div>
    ),
    size
  );
}
