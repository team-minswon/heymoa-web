import type { Metadata } from "next";
import Link from "next/link";

import { GoogleLoginButton } from "@/components/auth/google-login-button";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = {
  title: "로그인",
  description: `${siteConfig.name} 계정으로 로그인합니다.`,
};

/**
 * 랜딩의 로그인 모달과 **같이 존재한다.** 모달은 랜딩을 읽던 사람을 위한 것이고, 이 주소는
 * 세션이 끊겨 돌아온 사람과 링크를 받은 사람이 도착하는 자리다 — 모달만 두면 그들이 갈 곳이 없다.
 */
export default function LoginPage() {
  return (
    <main className="flex min-h-svh items-center justify-center bg-[var(--el-canvas)] px-6 py-16">
      <div className="w-[440px] max-w-full rounded-panel border border-[var(--el-hairline)] bg-card px-10 py-12 text-center">
        <p className="font-serif text-[18px] font-light tracking-[-0.02em]">
          {siteConfig.name}
        </p>
        <h1 className="mt-6 text-[26px] font-serif font-light leading-tight">
          회의를 기록하고
          <br />
          바로 일로 잇습니다
        </h1>
        <p className="mt-3 text-[13px] leading-6 text-[var(--el-muted)]">
          구글 계정으로 시작하세요. 따로 만들 것은 없습니다.
        </p>
        <div className="mt-8 flex justify-center">
          <GoogleLoginButton />
        </div>
        <p className="mt-8 text-[11px] leading-5 text-[var(--el-muted)]">
          계속하면{" "}
          <Link href="/terms" className="underline underline-offset-2">
            서비스 약관
          </Link>
          과{" "}
          <Link href="/privacy" className="underline underline-offset-2">
            개인정보 처리방침
          </Link>
          에 동의하는 것으로 봅니다.
        </p>
      </div>
    </main>
  );
}
