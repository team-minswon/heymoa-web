"use client";

import { CircleHelp, Monitor } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import type { DesktopFoundationBridge } from "@heymoa/desktop-contracts";

import { Button, buttonVariants } from "@/components/ui/button";
import { DesktopDownloadLink } from "@/components/heymoa/desktop-download-link";
import { DesktopCompareDialog } from "@/components/workspace/desktop-compare-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useRecording } from "@/components/transcription/recording-provider";
import { ACTIVE_PHASES } from "@/lib/transcription/recording-state";
import { desktopAuthBridge } from "@/lib/desktop/auth";
import { desktopUpdateBridge } from "@/lib/desktop/updates";
import {
  DESKTOP_INSTALLERS,
  DESKTOP_RELEASES_URL,
} from "@/lib/desktop/downloads";
import { useDesktopApp } from "@/lib/desktop/use-desktop-app";
import { cn } from "@/lib/utils";
import {
  hasDesktopUpdate,
  useDesktopUpdates,
} from "@/lib/desktop/use-desktop-updates";
import { useOpenSettings } from "./workspace-app-shell";
import { track } from "@/lib/analytics/track";

export function DesktopAppPromo() {
  const t = useTranslations("shell.desktopPromo");
  const isDesktopApp = useDesktopApp();
  const [compareOpen, setCompareOpen] = useState(false);
  if (isDesktopApp === true) {
    return desktopAuthBridge() && !desktopUpdateBridge() ? (
      <LegacyDesktopUpdateNotice />
    ) : (
      <DesktopUpdateNotice />
    );
  }
  if (isDesktopApp !== false) return null;

  return (
    <aside
      aria-label={t("label")}
      className="mb-5 hidden min-h-[68px] items-center gap-3 rounded-control border border-[var(--el-hairline)] bg-[var(--el-canvas-soft)] px-4 py-3 md:flex"
    >
      <Monitor aria-hidden className="size-5 shrink-0 text-[var(--el-muted)]" />
      <p className="min-w-0 flex-1 text-sm leading-6 font-medium text-[var(--el-ink)]">
        {t("body")}
        <Tooltip>
          <TooltipTrigger
            render={
              <button
                type="button"
                aria-label={t("compare")}
                onClick={() => setCompareOpen(true)}
                className="ml-1 inline-flex size-6 cursor-pointer items-center justify-center rounded-control align-middle text-[var(--el-muted)] transition-colors hover:text-[var(--el-ink)] focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
              />
            }
          >
            <CircleHelp aria-hidden className="size-4" />
          </TooltipTrigger>
          <TooltipContent
            side="top"
            sideOffset={8}
            className="whitespace-nowrap"
          >
            {t("compareTooltip")}
          </TooltipContent>
        </Tooltip>
      </p>
      <DesktopDownloadLink
        className={cn(
          buttonVariants({ variant: "outline" }),
          "h-10 shrink-0 rounded-chip border-[var(--el-hairline)] bg-white text-[var(--el-ink)] hover:bg-[var(--el-canvas-soft)]"
        )}
      />
      <DesktopCompareDialog open={compareOpen} onOpenChange={setCompareOpen} />
    </aside>
  );
}

/** Old native shells cannot install updates; use their existing external-download policy. */
function LegacyDesktopUpdateNotice() {
  const t = useTranslations("shell.desktopUpdate");
  const { phase, buffer } = useRecording();
  const busy = ACTIVE_PHASES.has(phase) || (buffer?.pendingMs ?? 0) > 0;
  const ua = navigator.userAgent;
  const version = /\bHeyMoa\/(\d+\.\d+\.\d+(?:[-+][\w.-]+)?)/.exec(ua)?.[1];
  const mac = /Macintosh|Mac OS X/.test(ua);
  const [macSupported, setMacSupported] = useState(false);
  const viewed = useRef(false);
  useEffect(() => {
    if (!mac) return;
    const bridge = desktopAuthBridge() as DesktopFoundationBridge | undefined;
    void bridge
      ?.getCapabilities()
      .then((value) => {
        setMacSupported(value.architecture === "arm64");
      })
      .catch(() => {});
  }, [mac]);
  useEffect(() => {
    if (viewed.current || (mac && !macSupported)) return;
    viewed.current = true;
    track("desktop_update_notice_viewed", {
      current_version: version,
      platform: mac ? "mac" : /Windows/.test(ua) ? "windows" : "other",
    });
  }, [mac, macSupported, ua, version]);
  if (mac && !macSupported) return null;
  const installer = /Windows/.test(ua)
    ? DESKTOP_INSTALLERS.windows[0]
    : /Macintosh|Mac OS X/.test(ua)
      ? DESKTOP_INSTALLERS.mac[0]
      : null;
  const href = installer
    ? `${DESKTOP_RELEASES_URL}/latest/download/${installer.file}`
    : DESKTOP_RELEASES_URL;
  return (
    <aside
      aria-label={t("label")}
      className="mb-5 flex items-center gap-3 rounded-control border border-[var(--el-hairline)] bg-[var(--el-canvas-soft)] px-4 py-3"
    >
      <Monitor aria-hidden className="size-5 shrink-0 text-[var(--el-muted)]" />
      <div className="min-w-0 flex-1">
        <p className="text-sm leading-6 font-medium text-[var(--el-ink)]">
          {t("body")}
        </p>
        <p className="mt-1 text-xs leading-5 text-[var(--el-muted)]">
          {version ? `${t("version", { version })} · ` : ""}
          {busy ? t("busy") : t("install")}
        </p>
      </div>
      <Button
        variant="outline"
        disabled={busy}
        className="h-10 shrink-0 rounded-chip bg-white whitespace-nowrap"
        render={
          busy ? undefined : (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() =>
                track("desktop_update_installer_clicked", {
                  surface: "dashboard",
                })
              }
            />
          )
        }
      >
        {t("download")}
      </Button>
    </aside>
  );
}

function DesktopUpdateNotice() {
  const state = useDesktopUpdates();
  const t = useTranslations("settings.appUpdates");
  const openSettings = useOpenSettings();
  if (!hasDesktopUpdate(state) || !state || !openSettings) return null;
  return (
    <aside
      aria-label={t("title")}
      className="mb-5 flex items-center gap-3 rounded-control border border-[var(--el-hairline)] bg-[var(--el-canvas-soft)] px-4 py-3"
    >
      <Monitor aria-hidden className="size-4 shrink-0 text-[var(--el-muted)]" />
      <p role="status" className="min-w-0 flex-1 text-sm text-[var(--el-ink)]">
        {t(`status.${state.status}`, {
          version: state.version ?? "",
          percent: state.percent ?? 0,
        })}
      </p>
      <Button
        variant="ghost"
        className="shrink-0"
        onClick={() => {
          const bridge = desktopUpdateBridge();
          if (bridge?.openPreferences) void bridge.openPreferences();
          else openSettings("appUpdates");
        }}
      >
        {t("title")}
      </Button>
    </aside>
  );
}
