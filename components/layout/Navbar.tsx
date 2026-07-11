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
    <header className="sticky top-0 z-40 border-b border-[var(--el-hairline)] bg-[var(--el-canvas)]/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
        {/* Left Logo Section */}
        <Link href="/" className="flex items-center gap-3">
          <Image
            src="/apple-touch-icon.png"
            alt={siteConfig.name}
            width={36}
            height={36}
            className="rounded-full object-contain"
            priority
            loading="eager"
          />
          <span>
            <span className="block text-[16px] font-medium tracking-tight text-[var(--el-ink)]">
              {siteConfig.name}
            </span>
          </span>
        </Link>

        {/* Middle Navigation - Hidden on Mobile */}
        <nav className="hidden md:flex items-center gap-8 text-[15px] font-medium text-[var(--el-muted)]">
          <button
            onClick={() => handleScroll("features")}
            className="hover:text-[var(--el-ink)] transition cursor-pointer"
          >
            기능 소개
          </button>
          <button
            onClick={() => handleScroll("how-it-works")}
            className="hover:text-[var(--el-ink)] transition cursor-pointer"
          >
            작동 방식
          </button>
        </nav>

        {/* Right Section */}
        <div className="flex items-center gap-3">
          <AuthStatus />
          <button
            onClick={() => handleScroll("start")}
            className="hidden sm:inline-flex h-10 items-center justify-center rounded-full bg-[var(--el-primary)] px-5 text-[15px] font-medium text-white transition hover:bg-[var(--el-primary-active)] focus:outline-none"
          >
            시작하기
          </button>
        </div>
      </div>
    </header>
  );
}
