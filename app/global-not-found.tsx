import type { Metadata } from "next";
import { EB_Garamond, Inter } from "next/font/google";

import "./globals.css";

/**
 * 어느 라우트에도 매치되지 않은 URL의 404.
 *
 * **루트 레이아웃을 안 거친다.** Next가 렌더를 건너뛰고 이 문서를 그대로 돌려주므로
 * `<html>`·`<body>`와 전역 스타일·폰트를 여기서 직접 들여온다. 그 덕에 봇·스캐너가
 * 두드리는 아무 경로마다 `getCurrentUserForSsr()`가 실서버를 부르는 일이 사라지고,
 * 루트 레이아웃이 실패해도 404 자리에 플랫폼 예외 화면이 뜨지 않는다.
 *
 * 세그먼트가 `notFound()`를 부르는 경우는 `app/not-found.tsx`가 맡는다 — 그쪽은 셸 안에
 * 그려야 하므로 역할이 다르다.
 *
 * 폰트는 둘만 싣는다(본문 Inter · 제목 EB Garamond). 404는 가장 많이 열리는 페이지라
 * 나머지를 여기까지 끌고 오지 않는다.
 */
const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const ebGaramond = EB_Garamond({
  variable: "--font-eb-garamond",
  subsets: ["latin"],
  weight: ["400"],
});

export const metadata: Metadata = {
  title: "페이지를 찾을 수 없습니다",
  description: "주소가 바뀌었거나 더 이상 제공하지 않는 페이지입니다.",
  robots: { index: false, follow: false },
};

export default function GlobalNotFound() {
  return (
    <html
      lang="ko"
      className={`${inter.variable} ${ebGaramond.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <div className="flex min-h-screen flex-col items-center justify-center bg-[var(--el-canvas)] p-4 text-center">
          {/* 표기는 「404 · 없는 주소입니다」 하나로 통일한다 — 「Error 404」 병용 금지
              (design.pen `TFJVM`). 34px 세리프 제목도 안 쓴다: 여기서 할 일은
              「없는 주소」를 페이지의 주제로 만드는 게 아니라 돌아갈 길을 주는 것이다. */}
          <p className="text-[15px] font-semibold text-[var(--el-ink)]">
            404 · 없는 주소입니다
          </p>
          <p className="mt-3 max-w-[420px] text-[13px] leading-[21px] text-[var(--el-body)]">
            주소가 바뀌었거나 더 이상 제공하지 않는 페이지입니다.
          </p>
          {/*
            **여기서는 <Link>를 쓰면 안 된다.** 이 문서는 앱 라우터 트리 밖이라 클라이언트
            이동이 반쪽만 동작한다 — 실측하면 주소와 제목만 `/`로 바뀌고 본문은 404 그대로
            남아서 사용자가 막다른 곳에 갇힌다. 새 문서를 여는 평범한 이동이 맞다.
          */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a
            href="/"
            className="mt-2.5 flex h-9 items-center rounded-control bg-[var(--el-primary)] px-3.5 text-[13px] font-medium text-[var(--el-on-primary)]"
          >
            홈으로
          </a>
        </div>
      </body>
    </html>
  );
}
