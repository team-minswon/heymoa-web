import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { ImageResponse } from "next/og";

import { helpT } from "@/lib/help/i18n";
import { clampedLines, fitTitle } from "@/lib/help/og-lines";
import { DEFAULT_LOCALE, isLocale } from "@/lib/i18n/locales";
import { siteConfig } from "@/lib/site";

// 판 안쪽 폭 1008px(1200 − 바깥 24×2 − 안쪽 72×2). 글자 폭이 근사값이라 여유를 둔다.
const TEXT_WIDTH = 960;
const TITLE_SIZES = [88, 76, 66, 58, 50, 44] as const;
const SUMMARY_SIZE = 30;

const LOGO = `data:image/png;base64,${await readFile(join(process.cwd(), "public/apple-touch-icon.png"), "base64")}`;

export const helpOgSize = { width: 1200, height: 630 };

export type HelpOgProps = { params: Promise<{ lang: string }> };

/**
 * 가이드 공유 카드의 metadata. alt 를 언어판마다 내려고 정적 `alt` 대신 이것을 쓴다(카드 한 장, id `card`).
 * Next 버전에 따라 `params` 가 값 또는 Promise 로 와서 둘 다 받는다.
 */
export async function helpOgMetadata({
  params,
}: {
  params: { lang: string } | Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const t = helpT(isLocale(lang) ? lang : DEFAULT_LOCALE);
  return [
    {
      id: "card",
      alt: t("brandTitle"),
      size: helpOgSize,
      contentType: "image/png",
    },
  ];
}

/**
 * 가이드 공유 카드 — 흰 바탕 · 라벤더 판에 제목과 요약을 얹는다. 색은 `TV_VARS`
 * 값을 직접 적는다(`ImageResponse` 는 CSS 변수를 모른다). 두 표기(HeyMoa · 헤이모아)가 모두 들어간다.
 */
export function helpOgImage(
  title: string,
  summary: string,
  label = "헤이모아 사용법"
) {
  const { size, lines } = fitTitle(title, TEXT_WIDTH, TITLE_SIZES, -3 / 88);
  const summaryLines = clampedLines(summary, SUMMARY_SIZE, TEXT_WIDTH, 2);
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
          <img
            src={LOGO}
            alt=""
            width={52}
            height={52}
            style={{ borderRadius: 999 }}
          />
          {siteConfig.name} · {label}
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          {/* 줄은 `og-lines.ts` 가 어절 단위로 나눈다. 줄마다 상자를 따로 둬 satori 가 다시 끊지 못하게 한다. */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              fontSize: size,
              lineHeight: 1.15,
              letterSpacing: -3 * (size / 88),
              wordBreak: "keep-all",
            }}
          >
            {lines.map((line) => (
              <div key={line} style={{ display: "flex" }}>
                {line}
              </div>
            ))}
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              marginTop: 28,
              fontSize: SUMMARY_SIZE,
              lineHeight: 1.45,
              color: "#433f69",
              wordBreak: "keep-all",
            }}
          >
            {summaryLines.map((line) => (
              <div key={line} style={{ display: "flex" }}>
                {line}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>,
    helpOgSize
  );
}
