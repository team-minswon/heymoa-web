"use client";

import { LogOut, UserRound } from "lucide-react";

import { useAuth } from "@/components/auth/auth-provider";
import { GoogleLoginButton } from "@/components/auth/google-login-button";
import { Button } from "@/components/ui/button";
import { isAuthApiConfigured } from "@/lib/auth/paths";

export function AuthStatus() {
  const { user, status, logout } = useAuth();

  if (status === "checking") {
    return (
      <div className="inline-flex h-10 items-center rounded-full border border-black/10 px-3 text-xs font-semibold text-black/50 sm:px-4 sm:text-sm">
        로그인 확인 중
      </div>
    );
  }

  if (status === "authenticated" && user) {
    const displayName = user.name ?? user.email ?? "사용자";

    return (
      <div className="flex items-center gap-2 sm:gap-3">
        <div className="flex min-w-0 items-center gap-2 rounded-full border border-black/10 bg-white px-3 py-1.5">
          {user.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={user.image}
              alt=""
              className="size-7 rounded-full object-cover"
              referrerPolicy="no-referrer"
            />
          ) : (
            <span className="grid size-7 place-items-center rounded-full bg-[var(--cg-ceramic)] text-[var(--cg-green)]">
              <UserRound className="size-4" />
            </span>
          )}
          <span className="hidden max-w-36 truncate text-sm font-semibold text-black/72 sm:block">
            {displayName}
          </span>
        </div>
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="rounded-full border-black/10 bg-white px-3 text-black/68 hover:text-[var(--cg-green)]"
          onClick={() => void logout()}
        >
          <LogOut className="size-4" />
          <span className="hidden sm:inline">로그아웃</span>
        </Button>
      </div>
    );
  }

  if (!isAuthApiConfigured) {
    return (
      <div className="inline-flex h-10 items-center rounded-full border border-amber-300 bg-amber-50 px-3 text-xs font-semibold text-amber-800 sm:px-4">
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
