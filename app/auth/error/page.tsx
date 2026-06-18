"use client";

import Link from "next/link";

export default function AuthErrorPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-radial from-zinc-900 via-zinc-950 to-black p-4 text-white">
      {/* Background glow effects */}
      <div className="absolute top-1/4 left-1/4 h-72 w-72 rounded-full bg-rose-600/5 blur-[100px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 h-72 w-72 rounded-full bg-red-600/5 blur-[100px] pointer-events-none" />

      <div className="relative z-10 flex w-full max-w-sm flex-col items-center gap-6 rounded-2xl border border-rose-500/10 bg-zinc-900/50 p-8 text-center shadow-2xl backdrop-blur-xl transition-all duration-300">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-rose-500/10 text-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.1)]">
          <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-zinc-100">로그인에 실패했습니다</h2>
          <p className="mt-2 text-sm text-zinc-400 leading-relaxed">
            인증 처리 과정에서 오류가 발생했습니다.<br />잠시 후 다시 시도해 주세요.
          </p>
        </div>
        <Link
          href="/"
          className="w-full rounded-lg bg-zinc-800 border border-zinc-700 px-4 py-2.5 text-sm font-medium text-zinc-200 transition-all duration-200 hover:bg-zinc-750 hover:text-white active:scale-98"
        >
          홈으로 돌아가기
        </Link>
      </div>
    </div>
  );
}
