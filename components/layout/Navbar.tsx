"use client";

import Image from "next/image";
import Link from "next/link";
import { LogOut } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { toast } from "sonner";

import { AuthStatus } from "@/components/auth/auth-status";
import { AuthModal } from "@/components/auth/auth-modal";
import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";
import { useGetWorkspaces } from "@/lib/api/generated/workspaces/workspaces";
import { siteConfig } from "@/lib/site";

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { status, isLoggingOut, logout } = useAuth();
  const workspacesQuery = useGetWorkspaces({
    query: { enabled: status === "authenticated", staleTime: 5 * 60 * 1000 },
  });
  const {
    isError: isWorkspacesError,
    isFetching: isFetchingWorkspaces,
    isPending: isWorkspacesPending,
    isSuccess: isWorkspacesSuccess,
    refetch: refetchWorkspaces,
  } = workspacesQuery;
  const workspaceEnvelope =
    workspacesQuery.data?.status === 200
      ? workspacesQuery.data.data
      : undefined;
  const workspaces = workspaceEnvelope?.success
    ? (workspaceEnvelope.data.workspaces ?? [])
    : [];
  const workspaceId =
    workspaces.find((workspace) => workspace.isDefault)?.workspaceId ??
    workspaces[0]?.workspaceId;
  const dashboardHref = workspaceId ? `/w/${workspaceId}` : null;
  const logoHref = dashboardHref ?? "/";
  const inWorkspace = pathname.startsWith("/w/");
  const shouldRetryWorkspaces =
    isWorkspacesError || (isWorkspacesSuccess && dashboardHref === null);

  useEffect(() => {
    if (!shouldRetryWorkspaces) return;

    const message = isWorkspacesError
      ? "대시보드를 불러오지 못했습니다."
      : "이동할 워크스페이스를 찾지 못했습니다.";

    toast.error(message, {
      id: "navbar-workspaces",
      description: "잠시 후 다시 확인해 주세요.",
      action: {
        label: "다시 시도",
        onClick: () => void refetchWorkspaces(),
      },
    });
  }, [isWorkspacesError, refetchWorkspaces, shouldRetryWorkspaces]);

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
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="xl"
                  loading={isLoggingOut}
                  aria-label="로그아웃"
                  onClick={() => void logout()}
                  className="rounded-full px-3 sm:px-4"
                >
                  <LogOut className="size-4" />
                  <span className="hidden sm:inline">로그아웃</span>
                </Button>
                {dashboardHref ? (
                  <Button
                    render={<Link href={dashboardHref} />}
                    size="xl"
                    className="rounded-full bg-[var(--el-primary)] px-4 text-white hover:bg-[var(--el-primary-active)] sm:px-5 sm:text-[15px]"
                  >
                    <span className="sm:hidden">대시보드</span>
                    <span className="hidden sm:inline">대시보드로 이동</span>
                  </Button>
                ) : isWorkspacesPending ? (
                  <Button
                    type="button"
                    size="xl"
                    loading
                    disabled
                    className="min-w-24 rounded-full px-4 sm:min-w-36 sm:px-5"
                  >
                    대시보드
                  </Button>
                ) : (
                  <Button
                    type="button"
                    size="xl"
                    loading={isFetchingWorkspaces}
                    disabled={isFetchingWorkspaces}
                    aria-label="대시보드 다시 시도"
                    onClick={() => void refetchWorkspaces()}
                    className="min-w-24 rounded-full px-4 sm:min-w-36 sm:px-5"
                  >
                    다시 시도
                  </Button>
                )}
              </div>
            ) : (
              <AuthModal>
                <button className="hidden sm:inline-flex h-10 items-center justify-center rounded-full bg-[var(--el-primary)] px-5 text-[15px] font-medium text-white transition hover:bg-[var(--el-primary-active)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--el-ink)] focus-visible:ring-offset-2">
                  시작하기
                </button>
              </AuthModal>
            ))}
        </div>
      </header>
    </div>
  );
}
