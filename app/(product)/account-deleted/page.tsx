import type { Metadata } from "next";
import { CircleCheck } from "lucide-react";
import Link from "next/link";

import { privateRouteMetadata } from "@/lib/site";

export const metadata: Metadata = privateRouteMetadata;

/**
 * 탈퇴 완료 화면(APP-1383). 이미 로그아웃된 뒤라 사실과 갈 곳만 보인다(userflow 「완료 화면·착지 화면」).
 */
export default function AccountDeletedPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[var(--el-canvas)] p-4 text-center">
      <CircleCheck className="mb-5 size-10 text-[var(--el-muted)]" />
      <h1 className="text-3xl font-light tracking-[-0.025em] text-balance text-[var(--el-ink)]">
        계정을 삭제했습니다
      </h1>
      <p className="mt-3 max-w-md text-sm leading-6 text-[var(--el-muted)]">
        모든 기기에서 로그아웃되었습니다. 남은 데이터는 차례로 지우고,
        백업에서는 7일 안에 사라집니다. 같은 Google 계정으로 다시 가입하면 새
        계정이 됩니다.
      </p>
      <Link
        href="/"
        className="mt-7 rounded-full bg-[var(--el-primary)] px-5 py-2.5 text-sm font-medium text-white"
      >
        홈으로
      </Link>
    </main>
  );
}
