"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { AuthStatus } from "@/components/auth/auth-status";
import { siteConfig } from "@/lib/site";

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();

  const handleScroll = (id: string) => {
    if (pathname === "/") {
      const el = document.getElementById(id);
      if (el) {
        el.scrollIntoView({ behavior: "smooth" });
      }
    } else {
      router.push(`/#${id}`);
    }
  };

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--clay-hairline)] bg-[var(--clay-canvas)]/40 backdrop-blur-xl shadow-[0_2px_12px_-4px_rgba(0,0,0,0.05)]">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
        {/* Left Logo Section */}
        <Link href="/" className="flex items-center gap-3">
          <Image
            src="/apple-touch-icon.png"
            alt="진짜그림"
            width={40}
            height={40}
            className="rounded-xl object-contain"
            priority
            loading="eager"
          />
          <span>
            <span className="block text-[17px] font-semibold leading-tight text-[var(--clay-primary)]">
              {siteConfig.name}
            </span>
            <span className="block text-xs font-medium text-[var(--clay-muted)]">
              realillust
            </span>
          </span>
        </Link>

        {/* Middle Navigation - Hidden on Mobile */}
        <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-[var(--clay-muted)]">
          <button
            onClick={() => handleScroll("analyze-box")}
            className="hover:text-[var(--clay-primary)] transition cursor-pointer"
          >
            분석하기
          </button>
          <button
            onClick={() => handleScroll("example-section")}
            className="hover:text-[var(--clay-primary)] transition cursor-pointer"
          >
            결과 예시
          </button>
          <button
            onClick={() => handleScroll("features-section")}
            className="hover:text-[var(--clay-primary)] transition cursor-pointer"
          >
            작동 방식
          </button>
          <button
            onClick={() => handleScroll("policy-section")}
            className="hover:text-[var(--clay-primary)] transition cursor-pointer"
          >
            이용 안내
          </button>
        </nav>

        {/* Right Section */}
        <div className="flex items-center gap-3">
          <AuthStatus />
          <button
            onClick={() => handleScroll("analyze-box")}
            className="hidden sm:inline-flex h-9 items-center justify-center rounded-xl bg-[var(--clay-primary)] px-4 text-xs font-bold text-white transition hover:bg-[var(--clay-brand-teal)] focus:outline-none"
          >
            이미지 분석 시작하기
          </button>
        </div>
      </div>
    </header>
  );
}
