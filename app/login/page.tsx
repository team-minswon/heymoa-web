import type { Metadata } from "next";
import Link from "next/link";

import { AuthCard } from "@/components/auth/auth-card";
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
    <AuthCard
      title="다시 오셨네요"
      description="회의를 기록하고 대화를 실제 업무로 연결합니다."
    >
      <GoogleLoginButton className="w-full" />
      <p className="text-center text-[11px] leading-[17px] text-[var(--el-muted)]">
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
    </AuthCard>
  );
}
