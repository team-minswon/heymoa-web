"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  ChevronDown,
  LogOut,
  Settings,
  Building2,
  ArrowLeft,
  UserRound,
} from "lucide-react";

import { useAuth } from "@/components/auth/auth-provider";
import { DashboardSidebar } from "@/components/dashboard/dashboard-sidebar";
import { PageTransition } from "@/components/layout/PageTransition";
import { getOrganizations } from "@/lib/organization/api";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuLinkItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { OrganizationDetail } from "@/lib/organization/types";

function getUserInitial(name: string) {
  return name.trim().charAt(0).toUpperCase() || "U";
}

export function DashboardShell({
  organization,
  children,
}: {
  organization: OrganizationDetail;
  children: React.ReactNode;
}) {
  const { user, logout } = useAuth();

  // Query organizations on the client side
  const { data: organizations } = useQuery({
    queryKey: ["organizations"],
    queryFn: getOrganizations,
  });

  const displayName = user?.name ?? user?.email ?? "사용자";

  return (
    <div className="flex min-h-screen flex-col bg-[var(--clay-canvas)] text-[var(--clay-primary)]">
      <header className="sticky top-0 z-30 border-b border-[var(--clay-hairline)] bg-[var(--clay-canvas)]/95 backdrop-blur shrink-0">
        <div className="flex h-16 items-center justify-between gap-4 px-4 md:px-6">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="inline-flex size-9 items-center justify-center rounded-xl border border-[var(--clay-hairline)] bg-[var(--clay-canvas)] text-[var(--clay-primary)] hover:bg-[var(--clay-surface-card)] transition shadow-sm"
              title="홈으로 이동"
            >
              <ArrowLeft className="size-4" />
            </Link>
            <Link
              href={`/dashboard/${organization.publicId}`}
              className="shrink-0 text-sm font-semibold hover:text-[var(--clay-brand-pink)] transition"
            >
              Realillust Dashboard
            </Link>
          </div>

          <div className="flex items-center gap-3">
            {/* User profile avatar / name info next to the organization switcher */}
            {user && (
              <div className="hidden items-center gap-2 sm:flex">
                <Avatar size="sm" className="size-7">
                  {user.image ? (
                    <AvatarImage
                      src={user.image}
                      alt=""
                      referrerPolicy="no-referrer"
                    />
                  ) : null}
                  <AvatarFallback className="bg-[var(--clay-brand-mint)] text-[var(--clay-primary)]">
                    {displayName ? (
                      getUserInitial(displayName)
                    ) : (
                      <UserRound className="size-4" />
                    )}
                  </AvatarFallback>
                </Avatar>
                <span className="text-xs font-semibold text-[var(--clay-muted)] truncate max-w-24">
                  {displayName}
                </span>
              </div>
            )}

            <DropdownMenu>
              <DropdownMenuTrigger className="inline-flex h-9 max-w-[12rem] items-center gap-2 rounded-xl border border-[var(--clay-hairline)] bg-[var(--clay-surface-card)] px-3 text-xs font-semibold text-[var(--clay-primary)] outline-none transition hover:bg-[var(--clay-surface-strong)] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 sm:max-w-[16rem]">
                <Building2 className="size-3.5 text-[var(--clay-muted)]" />
                <span className="truncate max-w-[80px] sm:max-w-[120px]">
                  {organization.name}
                </span>
                <ChevronDown className="size-3 text-[var(--clay-muted)]" />
              </DropdownMenuTrigger>

              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="px-2 py-1.5 text-xs text-[var(--clay-muted)] font-semibold uppercase tracking-wider">
                    조직 전환
                  </DropdownMenuLabel>
                  {organizations?.map((org) => {
                    const isCurrent = org.publicId === organization.publicId;
                    return (
                      <DropdownMenuLinkItem
                        key={org.publicId}
                        href={`/dashboard/${org.publicId}`}
                        closeOnClick
                        className={
                          isCurrent
                            ? "font-bold bg-[var(--clay-surface-soft)] text-[var(--clay-primary)]"
                            : "text-[var(--clay-muted)]"
                        }
                      >
                        <Building2 className="size-4 text-[var(--clay-muted)]" />
                        <span className="truncate flex-1">{org.name}</span>
                        {isCurrent && (
                          <span className="size-1.5 rounded-full bg-[var(--clay-brand-pink)] ml-auto" />
                        )}
                      </DropdownMenuLinkItem>
                    );
                  })}
                </DropdownMenuGroup>

                <DropdownMenuSeparator />

                <DropdownMenuGroup>
                  <DropdownMenuLabel className="px-2 py-1.5 text-xs text-[var(--clay-muted)] font-semibold uppercase tracking-wider">
                    사용자 설정
                  </DropdownMenuLabel>
                  <DropdownMenuLinkItem href="/settings" closeOnClick>
                    <Settings className="size-4 text-[var(--clay-muted)]" />내
                    정보
                  </DropdownMenuLinkItem>
                  <DropdownMenuLinkItem href="/" closeOnClick>
                    <ArrowLeft className="size-4 text-[var(--clay-muted)]" />
                    홈으로 이동
                  </DropdownMenuLinkItem>
                </DropdownMenuGroup>

                <DropdownMenuSeparator />

                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => void logout()}
                >
                  <LogOut className="size-4" />
                  로그아웃
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>
      <div className="flex flex-1 items-stretch">
        <DashboardSidebar organizationPublicId={organization.publicId} />
        <main className="min-w-0 flex-1 p-4 md:p-8">
          <PageTransition>{children}</PageTransition>
        </main>
      </div>
    </div>
  );
}
