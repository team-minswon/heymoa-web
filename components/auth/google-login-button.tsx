"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "@/lib/ui/toast";
import { track } from "@/lib/analytics/track";
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
  returnTo?: string;
  compact?: boolean;
  className?: string;
  /**
   * 약관 동의 전에는 로그인이 시작되지 않는다(APP-1277). 흐리게 보이지만 `disabled` 가 아니라 클릭을 받아
   * `onBlocked` 로 넘긴다 — 호출한 쪽이 이유를 알린다(APP-1402). `describedBy` 가 그 이유 문장이다.
   */
  blocked?: boolean;
  onBlocked?: () => void;
  describedBy?: string;
  /** 로그인을 실제로 시작하는 순간 한 번. Google 을 다녀오면 창이 사라지므로 그 전에 남길 것을 여기서 남긴다. */
  onLoginStart?: () => void;
};

export function GoogleLoginButton({
  returnTo,
  compact = false,
  className,
  blocked = false,
  onBlocked,
  describedBy,
  onLoginStart,
}: GoogleLoginButtonProps) {
  const t = useTranslations("auth.login");
  const [pending, setPending] = useState(false);

  // The app holds one native login at a time and the browser never calls back
  // when the user abandons Google, so closing the modal must release it.
  useEffect(() => {
    if (!pending) return;
    return () => void desktopAuthBridge()?.cancelAuth?.();
  }, [pending]);

  const handleLogin = async () => {
    if (pending) return;
    if (blocked) {
      onBlocked?.();
      return;
    }
    if (!isAuthApiConfigured) {
      toast.error(t("unavailable"), {
        id: "google-login-unavailable",
      });
      return;
    }

    setPending(true);
    track("login_started");
    onLoginStart?.();

    try {
      const desktop = desktopAuthBridge();
      if (desktop) {
        if (!desktop.beginLogin) {
          toast.error(t("updateApp"), {
            id: "google-login-update",
            action: {
              label: t("newVersion"),
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
        const destination = returnTo ?? getCurrentReturnTo();
        // Call immediately while the click's activation is still live.
        const outcome = await desktop.beginLogin();
        if (outcome.status === "success") {
          window.location.href = `/auth/callback?returnTo=${encodeURIComponent(destination)}`;
          return;
        }
        if (outcome.status !== "cancelled") {
          toast.error(
            outcome.reason === "timeout" ? t("timeout") : t("failed"),
            {
              id: "google-login-desktop",
            }
          );
        }
        setPending(false);
        return;
      }
      window.location.href = buildGoogleOAuthUrl(
        returnTo ?? getCurrentReturnTo()
      );
    } catch {
      toast.error(t("redirectFailed"), {
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
        aria-disabled={blocked || undefined}
        aria-describedby={blocked ? describedBy : undefined}
        className={cn(
          // Google branding: light theme = #FFF fill, 1px #747775 stroke, #1F1F1F text
          "rounded-full border-[#747775] bg-white font-medium text-[#1F1F1F] hover:bg-[#F8F9FA] hover:text-[#1F1F1F] aria-disabled:hover:bg-white aria-disabled:active:translate-y-0",
          compact ? "p-0" : "pl-3.5 pr-4"
        )}
        aria-label={t("googleLabel")}
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
        {!compact && <span>{t("google")}</span>}
      </Button>
    </div>
  );
}
