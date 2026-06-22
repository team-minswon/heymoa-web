"use client";

import { LogOut, Settings, UserRound } from "lucide-react";

import { useAuth } from "@/components/auth/auth-provider";
import { GoogleLoginButton } from "@/components/auth/google-login-button";
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
import { isAuthApiConfigured } from "@/lib/auth/paths";

function getUserInitial(name: string) {
  return name.trim().charAt(0).toUpperCase() || "U";
}

export function AuthStatus() {
  const { user, status, logout } = useAuth();

  if (status === "checking") {
    return (
      <div className="inline-flex h-10 items-center rounded-xl border border-[var(--clay-hairline)] px-3 text-xs font-semibold text-[var(--clay-muted)] sm:px-4 sm:text-sm">
        로그인 확인 중
      </div>
    );
  }

  if (status === "authenticated" && user) {
    const displayName = user.name ?? user.email ?? "사용자";

    return (
      <DropdownMenu>
        <DropdownMenuTrigger className="inline-flex h-10 max-w-[12rem] items-center gap-2 rounded-xl border border-[var(--clay-hairline)] bg-[var(--clay-canvas)] px-2.5 text-sm font-semibold text-[var(--clay-primary)] outline-none transition hover:bg-[var(--clay-surface-card)] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 sm:max-w-[16rem] sm:pl-2 sm:pr-3">
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
          <span className="hidden max-w-36 truncate text-sm font-semibold sm:block">
            {displayName}
          </span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuGroup>
            <DropdownMenuLabel className="px-2 py-1.5">
              <span className="block truncate text-sm font-semibold text-foreground">
                {displayName}
              </span>
              {user.email ? (
                <span className="mt-0.5 block truncate text-xs font-normal text-muted-foreground">
                  {user.email}
                </span>
              ) : null}
            </DropdownMenuLabel>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuLinkItem href="/settings" closeOnClick>
            <Settings className="size-4" />내 정보
          </DropdownMenuLinkItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={() => void logout()}>
            <LogOut className="size-4" />
            로그아웃
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  if (!isAuthApiConfigured) {
    return (
      <div className="inline-flex h-10 items-center rounded-xl border border-[var(--clay-brand-ochre)] bg-[var(--clay-surface-card)] px-3 text-xs font-semibold text-[var(--clay-primary)] sm:px-4">
        API URL 미설정
      </div>
    );
  }

  return (
    <div>
      <GoogleLoginButton compact className="sm:hidden" />
      <GoogleLoginButton className="hidden sm:flex" />
    </div>
  );
}
