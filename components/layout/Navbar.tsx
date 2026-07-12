"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { AuthStatus } from "@/components/auth/auth-status";
import { AuthModal } from "@/components/auth/auth-modal";
import { useAuth } from "@/components/auth/auth-provider";
import { useListWorkspaces } from "@/lib/api/generated/workspace/workspace";
import { siteConfig } from "@/lib/site";

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { status } = useAuth();
  const workspaceQuery = useListWorkspaces({
    query: { enabled: status === "authenticated", staleTime: 5 * 60 * 1000 },
  });
  const workspaceEnvelope =
    workspaceQuery.data?.status === 200 ? workspaceQuery.data.data : undefined;
  const workspaces = workspaceEnvelope?.success
    ? workspaceEnvelope.data.items
    : [];
  const workspaceId =
    workspaces.find((workspace) => workspace.isDefault)?.workspaceId ??
    workspaces[0]?.workspaceId;
  const logoHref = workspaceId ? `/w/${workspaceId}` : "/";
  const inWorkspace = pathname.startsWith("/w/");

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
    <div className="fixed top-4 left-0 right-0 z-40 mx-auto w-full max-w-5xl px-4 sm:px-6">
      <header className="flex items-center justify-between gap-4 rounded-full border border-[var(--el-hairline)] bg-white/70 px-4 py-2.5 sm:px-6 backdrop-blur-md shadow-[0_4px_24px_rgba(0,0,0,0.04)]">
        {/* Left Logo Section */}
        <Link href={logoHref} className="flex items-center gap-3">
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
        <nav
          className={`${inWorkspace ? "hidden" : "hidden md:flex"} items-center gap-8 text-[15px] font-medium text-[var(--el-muted)]`}
        >
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
          {!inWorkspace &&
            (status === "authenticated" ? (
              <Link
                href={logoHref}
                className="hidden sm:inline-flex h-10 items-center justify-center rounded-full bg-[var(--el-primary)] px-5 text-[15px] font-medium text-white transition hover:bg-[var(--el-primary-active)] focus:outline-none"
              >
                대시보드로 이동
              </Link>
            ) : (
              <AuthModal>
                <button className="hidden sm:inline-flex h-10 items-center justify-center rounded-full bg-[var(--el-primary)] px-5 text-[15px] font-medium text-white transition hover:bg-[var(--el-primary-active)] focus:outline-none">
                  시작하기
                </button>
              </AuthModal>
            ))}
        </div>
      </header>
    </div>
  );
}
