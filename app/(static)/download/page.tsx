import type { Metadata } from "next";
import Link from "next/link";

import { DESKTOP_RELEASES_URL } from "@/lib/desktop/downloads";

export const dynamic = "force-static";
export const metadata: Metadata = {
  title: "데스크톱 다운로드",
  description: "HeyMoa 데스크톱 베타 설치와 업데이트 안내",
  alternates: { canonical: "/download" },
};

export default function DownloadPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-20 text-[var(--el-body)] sm:py-28">
      <p className="mb-3 text-sm font-medium text-[var(--el-primary-active)]">
        HeyMoa 데스크톱 · 베타
      </p>
      <h1 className="text-3xl font-semibold tracking-tight text-[var(--el-ink)] sm:text-4xl">
        회의는 그대로, 기록은 더 가까이
      </h1>
      <p className="mt-5 text-base leading-7 text-[var(--el-muted)]">
        웹에서 쓰던 HeyMoa에 컴퓨터 오디오 녹음과 메뉴바 타임라인을 더했습니다.
        앱에서도 같은 웹 서비스를 사용합니다.
      </p>
      <a
        href={DESKTOP_RELEASES_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-8 inline-flex min-h-11 items-center rounded-full bg-[var(--el-primary)] px-6 py-3 text-sm font-semibold text-white hover:bg-[var(--el-primary-active)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--el-primary)]"
      >
        설치 파일과 새 버전 보기 ↗
      </a>
      <div className="mt-12 space-y-8 border-t border-[var(--el-hairline)] pt-8">
        <section>
          <h2 className="text-lg font-semibold text-[var(--el-ink)]">Mac</h2>
          <p className="mt-2 leading-7">
            macOS 14.2 이상에서 사용합니다. Apple Silicon은 arm64, Intel Mac은
            x64 DMG를 선택하고 HeyMoa를 응용 프로그램 폴더로 옮겨 주세요.
          </p>
          <p className="mt-2 text-sm leading-6 text-[var(--el-muted)]">
            현재 베타는 Apple 서명·공증이 없어 macOS가 실행을 차단할 수
            있습니다. 공식 설치 파일인지 확인한 뒤 시스템 설정 → 개인정보 보호
            및 보안에서 열기를 허용해 주세요.
          </p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-[var(--el-ink)]">
            Windows
          </h2>
          <p className="mt-2 leading-7">
            x64 EXE 설치 파일을 사용합니다. 베타 설치·녹음의 실제 Windows 검증은
            진행 중이며, 서명되지 않은 설치 파일에는 SmartScreen 경고가 표시될
            수 있습니다.
          </p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-[var(--el-ink)]">
            설정과 업데이트
          </h2>
          <p className="mt-2 leading-7">
            첫 실행에서 마이크 설정을 안내합니다. 컴퓨터 오디오 권한은 녹음을
            시작할 때 확인합니다. 권한 설정은 나중에도 할 수 있습니다.
          </p>
          <p className="mt-2 leading-7">
            새 버전은 위 공식 배포 페이지에서 확인해 주세요. 자동 업데이트는
            제공하지 않으므로 녹음을 중지하고 앱을 종료한 뒤 새 설치 파일로
            업데이트합니다.
          </p>
          <p className="mt-2 text-sm leading-6 text-[var(--el-muted)]">
            Homebrew 설치 명령과 각 파일의 SHA256은 공식 배포 페이지와 tap
            README에서 확인할 수 있습니다.
          </p>
        </section>
      </div>
      <Link
        href="/"
        className="mt-10 inline-block text-sm underline underline-offset-4"
      >
        웹으로 돌아가기
      </Link>
    </main>
  );
}
