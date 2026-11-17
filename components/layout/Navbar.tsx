"use client";

import Image from "next/image";
import Link from "next/link";
import { LogOut } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { toast } from "@/lib/ui/toast";

import { AuthStatus } from "@/components/auth/auth-status";
import { AuthModal } from "@/components/auth/auth-modal";
import { useAuth } from "@/components/auth/auth-provider";
import { Button, LinkButton } from "@/components/ui/button";
import { useGetWorkspaces } from "@/lib/api/generated/workspaces/workspaces";
import { siteConfig } from "@/lib/site";
import { pickWorkspaceId } from "@/lib/workspaces/last-workspace";

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const t = useTranslations("shell.navbar");
  const tActions = useTranslations("common.actions");
  const { status, isLoggingOut, logout } = useAuth();
  const workspacesQuery = useGetWorkspaces({
    query: { enabled: status === "authenticated", staleTime: 5 * 60 * 1000 },
  });
  const {
    isError: isWorkspacesError,
    isFetching: isFetchingWorkspaces,
    isPending: isWorkspacesPending,
    refetch: refetchWorkspaces,
  } = workspacesQuery;
  const workspaceEnvelope =
    workspacesQuery.data?.status === 200
      ? workspacesQuery.data.data
      : undefined;
  const workspaces = workspaceEnvelope?.success
    ? (workspaceEnvelope.data.workspaces ?? [])
    : [];
  const workspaceId = pickWorkspaceId(workspaces);
  const dashboardHref = workspaceId ? `/w/${workspaceId}` : null;
  const logoHref = dashboardHref ?? "/";
  const inWorkspace = pathname.startsWith("/w/");
  useEffect(() => {
    if (!isWorkspacesError) return;

    toast.error(t("loadFailed"), {
      id: "navbar-workspaces",
      description: t("loadFailedDescription"),
      action: {
        label: tActions("retry"),
        onClick: () => void refetchWorkspaces(),
      },
    });
  }, [isWorkspacesError, refetchWorkspaces, t, tActions]);

  const handleScroll = (id: string) => {
    router.push(`/#${id}`);
  };

  return (
    <div className="fixed top-4 left-0 right-0 z-40 mx-auto w-full max-w-5xl px-4 sm:px-6">
      <header className="flex items-center justify-between gap-4 rounded-full border border-[var(--el-hairline)] bg-white/70 px-4 py-2.5 sm:px-6 backdrop-blur-md shadow-[0_4px_24px_rgba(0,0,0,0.04)]">
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

        <nav
          className={`${inWorkspace ? "hidden" : "hidden md:flex"} items-center gap-8 text-[15px] font-medium text-[var(--el-muted)]`}
        >
          <button
            onClick={() => handleScroll("meetings")}
            className="min-h-6 cursor-pointer transition hover:text-[var(--el-ink)]"
          >
            {t("sections.meetings")}
          </button>
          <button
            onClick={() => handleScroll("evidence")}
            className="min-h-6 cursor-pointer transition hover:text-[var(--el-ink)]"
          >
            {t("sections.evidence")}
          </button>
        </nav>

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
                  aria-label={t("logout")}
                  onClick={() => void logout()}
                  className="rounded-full px-3 sm:px-4"
                >
                  <LogOut className="size-4" />
                  <span className="hidden sm:inline">{t("logout")}</span>
                </Button>
                {dashboardHref ? (
                  <LinkButton
                    href={dashboardHref}
                    size="xl"
                    className="rounded-full bg-[var(--el-primary)] px-4 text-white hover:bg-[var(--el-primary-active)] sm:px-5 sm:text-[15px]"
                  >
                    <span className="sm:hidden">{t("dashboardShort")}</span>
                    <span className="hidden sm:inline">{t("dashboard")}</span>
                  </LinkButton>
                ) : isWorkspacesPending ? (
                  <Button
                    type="button"
                    size="xl"
                    loading
                    disabled
                    className="rounded-full px-4 sm:px-5 sm:text-[15px]"
                  >
                    <span className="sm:hidden">{t("dashboardShort")}</span>
                    <span className="hidden sm:inline">{t("dashboard")}</span>
                  </Button>
                ) : isWorkspacesError ? (
                  <Button
                    type="button"
                    size="xl"
                    loading={isFetchingWorkspaces}
                    disabled={isFetchingWorkspaces}
                    aria-label={t("retryLabel")}
                    onClick={() => void refetchWorkspaces()}
                    className="min-w-24 rounded-full px-4 sm:min-w-36 sm:px-5"
                  >
                    {tActions("retry")}
                  </Button>
                ) : null}
              </div>
            ) : (
              <AuthModal>
                <Button
                  type="button"
                  size="xl"
                  className="hidden rounded-full bg-[var(--el-primary)] px-5 text-[15px] text-white hover:bg-[var(--el-primary-active)] sm:inline-flex"
                >
                  {t("start")}
                </Button>
              </AuthModal>
            ))}
        </div>
      </header>
    </div>
  );
}
