import Link from "next/link";
import { Shield } from "lucide-react";

import { AuthStatus } from "@/components/auth/auth-status";
import { siteConfig } from "@/lib/site";

export function Navbar() {
  return (
    <header className="sticky top-0 z-40 border-b border-[var(--clay-hairline)] bg-[var(--clay-canvas)]/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-[var(--clay-primary)] text-white">
            <Shield className="size-5" />
          </span>
          <span>
            <span className="block text-[17px] font-semibold leading-tight">
              {siteConfig.name}
            </span>
            <span className="block text-xs font-medium text-[var(--clay-muted)]">
              AI 일러스트 검사
            </span>
          </span>
        </Link>
        <AuthStatus />
      </div>
    </header>
  );
}
