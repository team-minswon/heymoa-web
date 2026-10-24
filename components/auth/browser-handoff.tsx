"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { AppWindow } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { BrowserHandoffPrompt } from "@/components/auth/in-app-login-gate";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { track } from "@/lib/analytics/track";
import {
  buildBrowserLandingUrl,
  detectInAppBrowser,
  handoffOs,
  parseHandoffContext,
  type HandoffContext,
} from "@/lib/auth/in-app-browser";
import { desktopAuthBridge } from "@/lib/desktop/auth";
import { isLandingHome } from "@/lib/routes/app-route";

const ATTEMPT_KEY = "heymoa:browser-handoff-attempted";

/** Move landing visitors before OAuth; never automatically launch from callbacks or product screens. */
export function BrowserHandoff() {
  const { status } = useAuth();
  const t = useTranslations("auth.browser");
  const handled = useRef(false);
  const arrivalRecorded = useRef(false);
  const [prompt, setPrompt] = useState<{
    context: HandoffContext;
    target: string;
    automatic: boolean;
  } | null>(null);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    if (desktopAuthBridge()) return;
    const current = new URL(window.location.href);
    const app = detectInAppBrowser(navigator.userAgent);
    const source = parseHandoffContext(
      current.searchParams.get("handoff_app"),
      current.searchParams.get("handoff_os")
    );
    if (source && !app && !arrivalRecorded.current) {
      arrivalRecorded.current = true;
      track("browser_handoff_arrived", source);
      current.searchParams.delete("handoff_app");
      current.searchParams.delete("handoff_os");
      window.history.replaceState(
        null,
        "",
        current.pathname + current.search + current.hash
      );
    }
    if (
      handled.current ||
      status !== "anonymous" ||
      !isLandingHome(current.pathname)
    )
      return;
    handled.current = true;
    if (!app || !["instagram", "threads", "kakao", "line"].includes(app))
      return;
    const context = { app, os: handoffOs(navigator.userAgent) };
    if (context.os === "other") return;
    try {
      if (sessionStorage.getItem(ATTEMPT_KEY)) return;
      sessionStorage.setItem(ATTEMPT_KEY, "1");
    } catch {
      // The ref still prevents repeated attempts within this document when storage is blocked.
    }
    // A destination reopened inside the app receives instructions instead of another auto-launch.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- synchronize the entry URL with its handoff dialog
    setPrompt({
      context,
      target: buildBrowserLandingUrl(current.href, context),
      automatic: !source,
    });
  }, [status]);

  if (!prompt) return null;
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        className="top-auto bottom-[max(1rem,env(safe-area-inset-bottom))] -translate-y-0 sm:max-w-[420px] rounded-2xl p-4 sm:p-6 gap-4"
        aria-describedby={undefined}
      >
        <DialogHeader className="items-center text-center">
          <span
            className="mb-1 flex size-9 items-center justify-center rounded-xl bg-[var(--el-surface-strong)]"
            aria-hidden="true"
          >
            <AppWindow className="size-5" />
          </span>
          <DialogTitle className="text-balance text-lg leading-7">
            {t("entryTitle")}
          </DialogTitle>
        </DialogHeader>
        <BrowserHandoffPrompt {...prompt} entry />
      </DialogContent>
    </Dialog>
  );
}
