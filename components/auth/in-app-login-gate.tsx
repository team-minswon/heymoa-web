"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { useTranslations } from "next-intl";
import { ExternalLink, Globe2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { track, withAnalyticsHandoff } from "@/lib/analytics/track";
import {
  buildBrowserLoginUrl,
  detectInAppBrowser,
  externalBrowserUrl,
  handoffOs,
  type HandoffContext,
} from "@/lib/auth/in-app-browser";
import { desktopAuthBridge } from "@/lib/desktop/auth";

const subscribe = () => () => {};
const getApp = () =>
  desktopAuthBridge() ? null : detectInAppBrowser(navigator.userAgent);
const serverApp = () => null;

/** Browser selection precedes consent and OAuth, so neither is silently transferred. */
export function InAppLoginGate({
  children,
  returnTo,
  enabled = true,
}: {
  children: ReactNode;
  returnTo?: string;
  enabled?: boolean;
}) {
  const app = useSyncExternalStore(subscribe, getApp, serverApp);
  if (!app || !enabled) return children;
  const context = { app, os: handoffOs(navigator.userAgent) };
  return (
    <BrowserHandoffPrompt
      context={context}
      target={buildBrowserLoginUrl(window.location.href, context, returnTo)}
    />
  );
}

export function BrowserHandoffPrompt({
  context,
  target,
  automatic = false,
  entry = false,
}: {
  context: HandoffContext;
  target: string;
  automatic?: boolean;
  entry?: boolean;
}) {
  const t = useTranslations("auth.browser");
  const [attempted, setAttempted] = useState(false);
  const [opening, setOpening] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const [copied, setCopied] = useState(false);
  const guideShown = useRef(false);
  const autoAttempted = useRef(false);
  const { app, os } = context;
  const openBrowser = useCallback(
    (interaction: "automatic" | "click") => {
      const context = { app, os };
      // Only a launched link carries analytics IDs; a copied one may be forwarded to someone else.
      const link = externalBrowserUrl(withAnalyticsHandoff(target), context);
      track("browser_handoff_attempted", {
        ...context,
        method: !link
          ? "manual"
          : link.startsWith("intent:")
            ? "android_intent"
            : link.startsWith("https:") || link.startsWith("http:")
              ? "app_parameter"
              : "app_scheme",
        trigger: entry ? "entry" : "login",
        interaction,
      });
      setAttempted(true);
      setOpening(Boolean(link));
      // A returned navigation call is not proof of arrival. The target page records arrival separately.
      try {
        if (link) window.location.assign(link);
      } catch {
        // Blocked schemes leave the manual instructions below available.
      }
    },
    [app, os, target, entry]
  );

  useEffect(() => {
    if (!automatic || autoAttempted.current) return;
    autoAttempted.current = true;
    openBrowser("automatic");
  }, [automatic, openBrowser]);

  useEffect(() => {
    if (!opening) return;
    // This only changes the available UI; a timeout is not evidence that the handoff failed.
    const timer = window.setTimeout(() => setOpening(false), 1200);
    return () => window.clearTimeout(timer);
  }, [opening]);

  useEffect(() => {
    if (!attempted || opening || guideShown.current) return;
    const recordGuide = () => {
      if (document.visibilityState !== "visible" || guideShown.current) return;
      guideShown.current = true;
      track("browser_handoff_guide_shown", { app, os });
    };
    recordGuide();
    document.addEventListener("visibilitychange", recordGuide);
    return () => document.removeEventListener("visibilitychange", recordGuide);
  }, [attempted, opening, app, os]);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(target);
      setCopied(true);
      setCopyFailed(false);
      track("browser_handoff_link_copied", context);
    } catch {
      setCopyFailed(true);
    }
  }

  return (
    <div className={entry ? "space-y-3 text-center" : "space-y-4 text-center"}>
      <p className="whitespace-pre-line text-sm leading-6 text-[var(--el-body)]">
        {t(
          opening
            ? "openingDescription"
            : entry
              ? "entryDescription"
              : "description"
        )}
      </p>
      {entry && (
        <span className="mx-auto flex w-fit items-center gap-1.5 rounded-full border border-[var(--el-hairline)] bg-[var(--el-surface-card)] px-3 py-1.5 text-xs text-[var(--el-body)]">
          <Globe2 className="size-3.5" aria-hidden="true" />
          heymoa.app
        </span>
      )}
      {opening ? (
        <div
          role="status"
          className="flex items-center justify-center gap-2 py-3 text-sm text-[var(--el-muted)]"
        >
          <Loader2
            className="size-5 animate-spin motion-reduce:animate-none"
            aria-hidden="true"
          />
          {t("opening")}
        </div>
      ) : (
        <>
          <Button
            size="xl"
            className="w-full rounded-full"
            onClick={() => openBrowser("click")}
          >
            <ExternalLink className="size-4" aria-hidden="true" />
            {t(entry ? "continueInBrowser" : "open")}
          </Button>
          {attempted && (
            <div
              role="status"
              className={`space-y-3 border-t border-[var(--el-hairline)] ${entry ? "pt-3 text-[13px] leading-5" : "pt-4 text-sm leading-6"}`}
            >
              <p className={entry ? "whitespace-pre-line" : undefined}>
                {t(entry ? "entryInstructions" : "instructions")}
              </p>
              <Button variant="outline" onClick={copyLink}>
                {copied ? t("copied") : t(entry ? "copyEntry" : "copy")}
              </Button>
              {copyFailed && (
                <label className="block text-left">
                  {t("copyManually")}
                  <input
                    readOnly
                    value={target}
                    onFocus={(event) => event.currentTarget.select()}
                    className="mt-2 w-full rounded border border-[var(--el-hairline)] p-2 text-xs"
                  />
                </label>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
