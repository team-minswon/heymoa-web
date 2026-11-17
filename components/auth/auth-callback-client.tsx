"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, Home, Loader2, LogIn } from "lucide-react";

import { useAuth } from "@/components/auth/auth-provider";
import {
  ConsentStep,
  type ConsentStepMode,
} from "@/components/auth/consent-step";
import { WELCOME_PARAM } from "@/components/heymoa/landing-cta";
import { identifyUser, track, trackConversion } from "@/lib/analytics/track";
import { getWorkspaces } from "@/lib/api/generated/workspaces/workspaces";
import { getMe } from "@/lib/auth/api";
import { recordConsentNow, settleLoginConsent } from "@/lib/auth/login-consent";
import { normalizeReturnTo } from "@/lib/auth/paths";
import { pickWorkspaceId } from "@/lib/workspaces/last-workspace";

async function enterApp(
  router: ReturnType<typeof useRouter>,
  returnTo?: string
) {
  const destination = normalizeReturnTo(returnTo);
  if (destination !== "/") {
    router.replace(destination);
    return;
  }
  const response = await getWorkspaces();
  if (response.status !== 200 || !response.data.success) {
    throw new Error("WORKSPACE_LIST_FAILED");
  }
  const items = response.data.data.workspaces ?? [];
  const selected = pickWorkspaceId(items);
  if (!selected) {
    router.replace(`/?${WELCOME_PARAM}`);
    return;
  }
  router.replace(`/w/${selected}`);
}

export function AuthCallbackClient({
  urlError,
  returnTo,
}: {
  urlError?: string;
  returnTo?: string;
}) {
  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-[var(--el-canvas)] p-4 text-[var(--el-ink)]">
      <CallbackProcessor urlError={urlError} returnTo={returnTo} />
    </main>
  );
}

export function CallbackProcessor({
  urlError,
  returnTo,
}: {
  urlError?: string;
  returnTo?: string;
} = {}) {
  const router = useRouter();
  const t = useTranslations("auth.callback");
  const { setUser } = useAuth();
  const [errorDetails, setErrorDetails] = useState<{
    title: string;
    description: string;
  } | null>(null);
  const [consentMode, setConsentMode] = useState<ConsentStepMode | null>(null);

  useEffect(() => {
    let ignore = false;

    async function checkAuth() {
      if (urlError) {
        if (!ignore) {
          setErrorDetails({
            title: t("failedTitle"),
            description: t("failedDescription"),
          });
        }
        return;
      }

      try {
        const user = await getMe();

        if (!user) throw new Error("AUTHENTICATED_SESSION_REQUIRED");

        if (!ignore) {
          setUser(user);
          identifyUser(user.userId);
          track("login_completed");
          const callbackUrl = new URL(window.location.href);
          if (callbackUrl.searchParams.get("signup") === "1") {
            callbackUrl.searchParams.delete("signup");
            window.history.replaceState(window.history.state, "", callbackUrl);
            trackConversion("sign_up", { method: "google" });
          }

          let consent: "done" | "ask" | "retry";
          try {
            consent = await settleLoginConsent();
          } catch (error) {
            console.error("Login consent failed:", error);
            consent = "retry";
          }
          if (ignore) return;
          if (consent !== "done") {
            setConsentMode(consent);
            return;
          }

          await enterApp(router, returnTo);
        }
      } catch (error) {
        if (!ignore) {
          console.error("Auth check failed:", error);
          setErrorDetails({
            title: t("failedTitle"),
            description: t("failedDescription"),
          });
        }
      }
    }

    void checkAuth();

    return () => {
      ignore = true;
    };
  }, [returnTo, router, setUser, urlError, t]);

  const submitConsent = async () => {
    if (consentMode === "ask") {
      await recordConsentNow();
    } else if ((await settleLoginConsent()) === "ask") {
      setConsentMode("ask");
      return;
    }
    try {
      await enterApp(router, returnTo);
    } catch (error) {
      console.error("Auth check failed:", error);
      setConsentMode(null);
      setErrorDetails({
        title: t("failedTitle"),
        description: t("failedDescription"),
      });
    }
  };

  if (consentMode && !errorDetails) {
    return (
      <ConsentStep
        key={consentMode}
        mode={consentMode}
        onSubmit={submitConsent}
      />
    );
  }

  if (errorDetails) {
    return (
      <div className="w-full max-w-md rounded-panel border border-[var(--el-hairline)] bg-white p-8 text-center shadow-[0_16px_48px_rgba(12,10,9,0.08)]">
        <AlertTriangle className="mx-auto mb-5 size-10 text-[var(--el-error)]" />
        <h1 className="text-3xl font-light tracking-[-0.025em] text-[var(--el-ink)]">
          {errorDetails.title}
        </h1>
        <p className="mt-3 text-sm leading-6 text-[var(--el-muted)]">
          {errorDetails.description}
        </p>
        <div className="mt-6 flex flex-col gap-3">
          <Link
            href="/?login=true"
            className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-full bg-[var(--el-primary)] text-sm font-medium text-white transition hover:bg-[var(--el-primary-active)]"
          >
            <LogIn className="size-4" />
            {t("retry")}
          </Link>
          <Link
            href="/"
            className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-full border border-[var(--el-hairline-strong)] bg-white text-sm font-medium text-[var(--el-ink)] transition hover:bg-[var(--el-canvas-soft)]"
          >
            <Home className="size-4" />
            {t("home")}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center text-center">
      <Loader2 className="mb-5 size-8 animate-spin text-[var(--el-ink)]" />
      <h1 className="text-3xl font-light tracking-[-0.025em] text-[var(--el-ink)]">
        {t("signingIn")}
      </h1>
      <p className="mt-2 text-sm text-[var(--el-muted)]">{t("preparing")}</p>
    </div>
  );
}
