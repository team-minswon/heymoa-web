"use client";

import Image from "next/image";
import Link from "next/link";
import { LogOut } from "lucide-react";

import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";
import { siteConfig } from "@/lib/site";

/**
 * 카드 하나만 세우는 흐름(`isFocusChromeRoute` — 외부 에이전트 동의 · 초대)의 머리글. 메뉴 없이 로고와 로그아웃만 둔다.
 * 메뉴가 있으면 연결 · 합류 도중에 다른 곳으로 새고, 로그아웃은 남겨야 다른 계정으로 바꿀 수 있다(초대가 다른 이메일용일 때,
 * 동의 화면에 엉뚱한 계정의 워크스페이스가 보일 때). 로고는 링크가 아니다 — 흐름 밖으로 나가는 길을 하나 더 두지 않는다.
 *
 * 로그인한 사람은 SSR 이 `initialData` 를 채워 `checking` 을 안 지나므로, 로그아웃이 뒤늦게 끼어들며 밀리는 일은 없다.
 */
export function FocusTopBar() {
  const { status, isLoggingOut, logout } = useAuth();

  return (
    <header className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between gap-4 px-4 sm:px-6">
      <span className="inline-flex items-center gap-2.5">
        <Image
          src="/apple-touch-icon.png"
          alt=""
          width={32}
          height={32}
          className="rounded-full object-contain"
          priority
        />
        <span className="text-[18px] font-medium tracking-tight text-[var(--el-ink)]">
          {siteConfig.name}
        </span>
      </span>
      {status === "authenticated" ? (
        <Button
          type="button"
          variant="ghost"
          size="lg"
          className="px-3 text-sm text-[var(--el-muted)]"
          loading={isLoggingOut}
          onClick={() => void logout()}
        >
          <LogOut aria-hidden />
          로그아웃
        </Button>
      ) : null}
    </header>
  );
}

const LINK =
  "inline-flex min-h-6 items-center rounded-[4px] transition-colors hover:text-[var(--el-ink)] hover:underline";

/** 같은 흐름의 발. 약관 · 개인정보만 둔다. */
export function FocusFooter() {
  return (
    <footer className="flex items-center justify-center gap-2 px-4 pt-2 pb-6 text-sm text-[var(--el-muted)]">
      <Link href="/terms" className={LINK}>
        이용약관
      </Link>
      <span aria-hidden>·</span>
      <Link href="/privacy" className={LINK}>
        개인정보 처리방침
      </Link>
    </footer>
  );
}
