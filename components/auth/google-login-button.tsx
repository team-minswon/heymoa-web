"use client";

import { useState } from "react";
import { toast } from "@/lib/ui/toast";
import { DESKTOP_RELEASES_URL } from "@/lib/desktop/downloads";

import { Button } from "@/components/ui/button";
import {
  buildGoogleOAuthUrl,
  getCurrentReturnTo,
  isAuthApiConfigured,
} from "@/lib/auth/paths";
import { cn } from "@/lib/utils";
import { desktopAuthBridge } from "@/lib/desktop/auth";

type GoogleLoginButtonProps = {
  compact?: boolean;
  className?: string;
};

export function GoogleLoginButton({
  compact = false,
  className,
}: GoogleLoginButtonProps) {
  const [pending, setPending] = useState(false);

  const handleLogin = async () => {
    if (pending) return;
    if (!isAuthApiConfigured) {
      toast.error("현재 로그인을 사용할 수 없습니다.", {
        id: "google-login-unavailable",
      });
      return;
    }

    setPending(true);

    try {
      const desktop = desktopAuthBridge();
      if (desktop) {
        if (!desktop.beginLogin) {
          toast.error("앱을 업데이트한 뒤 다시 로그인해 주세요.", {
            id: "google-login-update",
            action: {
              label: "새 버전 보기",
              onClick: () =>
                window.open(
                  DESKTOP_RELEASES_URL,
                  "_blank",
                  "noopener,noreferrer"
                ),
            },
          });
          setPending(false);
          return;
        }
        const returnTo = getCurrentReturnTo();
        // Call immediately while the click's activation is still live.
        const outcome = await desktop.beginLogin();
        if (outcome.status === "success") {
          window.location.href = `/auth/callback?returnTo=${encodeURIComponent(returnTo)}`;
          return;
        }
        if (outcome.status !== "cancelled") {
          toast.error(
            outcome.reason === "timeout"
              ? "로그인 시간이 지났습니다. 다시 시도해 주세요."
              : "로그인하지 못했습니다. 다시 시도해 주세요.",
            {
              id: "google-login-desktop",
            }
          );
        }
        setPending(false);
        return;
      }
      window.location.href = buildGoogleOAuthUrl(getCurrentReturnTo());
    } catch {
      toast.error("로그인 페이지로 이동하지 못했습니다. 다시 시도해 주세요.", {
        id: "google-login-redirect",
      });
      setPending(false);
    }
  };

  return (
    <div className={className}>
      <Button
        type="button"
        variant="outline"
        size={compact ? "icon-xl" : "xl"}
        onClick={handleLogin}
        loading={pending}
        className={cn(
          "rounded-full border-[var(--el-hairline)] bg-[var(--el-canvas)] font-medium text-[var(--el-ink)] hover:bg-[var(--el-surface-strong)]",
          compact ? "p-0" : "pl-3.5 pr-4"
        )}
        aria-label="Google로 로그인"
      >
        <svg className="size-[18px]" viewBox="0 0 24 24" aria-hidden="true">
          <path
            fill="#4285F4"
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
          />
          <path
            fill="#34A853"
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
          />
          <path
            fill="#FBBC05"
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
          />
          <path
            fill="#EA4335"
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
          />
        </svg>
        {!compact && <span>Google 로그인</span>}
      </Button>
    </div>
  );
}
