"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import type { DesktopUpdateState } from "@heymoa/desktop-contracts";
import { useDesktopApp } from "@/lib/desktop/use-desktop-app";
import { desktopUpdateBridge } from "@/lib/desktop/updates";
import { DESKTOP_RELEASES_URL } from "@/lib/desktop/downloads";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { SettingsHeader, SETTINGS_CARD } from "./settings-layout";
import { track, type WebEventProperties } from "@/lib/analytics/track";

export function DesktopUpdateSettings() {
  const t = useTranslations("settings.appUpdates");
  const [state, setState] = useState<DesktopUpdateState | null>(null);
  const desktop = useDesktopApp();
  const bridge = desktopUpdateBridge();
  const supported = desktop === null ? null : Boolean(bridge);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const bridge = desktopUpdateBridge();
    if (!bridge) return;
    let live = true;
    let received = false;
    const unsubscribe = bridge.subscribeUpdates((next) => {
      received = true;
      if (live) setState(next);
    });
    void bridge
      .getUpdateState()
      .then((next) => {
        if (live && !received) setState(next);
      })
      .catch(() => {
        if (live) setFailed(true);
      });
    return () => {
      live = false;
      unsubscribe();
    };
  }, []);
  async function run(
    work: () => Promise<DesktopUpdateState>,
    action: WebEventProperties["desktop_update_request_failed"]["action"]
  ) {
    setBusy(true);
    setFailed(false);
    try {
      const next = await work();
      setState(next);
      if (action === "automatic")
        track("desktop_update_automatic_changed", {
          current_version: next.currentVersion,
          enabled: next.automatic,
        });
    } catch {
      track("desktop_update_request_failed", { action });
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }
  const working =
    state?.status === "checking" ||
    state?.status === "downloading" ||
    state?.status === "installing";
  return (
    <section className="mx-auto max-w-[720px]">
      <SettingsHeader title={t("title")} description={t("description")} />
      {supported === false ? (
        <div className={SETTINGS_CARD}>
          <p className="mb-4 text-sm text-[var(--el-muted)]">
            {t("upgradeRequired")}
          </p>
          <Button
            variant="outline"
            render={
              <a
                href={DESKTOP_RELEASES_URL}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() =>
                  track("desktop_update_installer_clicked", {
                    surface: "settings",
                  })
                }
              />
            }
          >
            {t("getApp")}
          </Button>
        </div>
      ) : !state ? (
        <div className={SETTINGS_CARD}>
          {failed ? (
            <Button
              variant="outline"
              onClick={() =>
                bridge && void run(() => bridge.getUpdateState(), "state")
              }
            >
              {t("retry")}
            </Button>
          ) : (
            <Skeleton className="h-5 w-40" aria-label={t("loading")} />
          )}
        </div>
      ) : (
        <div className="space-y-6">
          <div className={SETTINGS_CARD}>
            <p className="text-sm font-medium">
              {t("currentVersion", { version: state.currentVersion })}
            </p>
            <p role="status" className="mt-2 text-sm text-[var(--el-muted)]">
              {t(`status.${state.status}`, {
                version: state.version ?? "",
                percent: state.percent ?? 0,
              })}
            </p>
            {state.status === "downloading" ? (
              <progress
                className="mt-4 h-2 w-full"
                aria-label={t("downloadProgress")}
                max={100}
                value={state.percent ?? 0}
              />
            ) : null}
            <div className="mt-5 flex flex-wrap gap-3">
              {state.status === "ready" ? (
                <Button
                  disabled={busy || !state.canRestart}
                  loading={busy}
                  onClick={() => {
                    if (!bridge) return;
                    track(
                      "desktop_update_restart_requested",
                      {
                        current_version: state.currentVersion,
                        target_version: state.version,
                      },
                      { send_instantly: true, transport: "sendBeacon" }
                    );
                    void run(() => bridge.restartForUpdate(), "restart");
                  }}
                >
                  {t("restart")}
                </Button>
              ) : (
                <Button
                  variant="outline"
                  disabled={busy || working || state.status === "unavailable"}
                  loading={state.status === "checking" || busy}
                  onClick={() => {
                    if (!bridge) return;
                    track("desktop_update_check_clicked", {
                      current_version: state.currentVersion,
                    });
                    void run(() => bridge.checkForUpdates(), "check");
                  }}
                >
                  {state.status === "error" ? t("retry") : t("check")}
                </Button>
              )}
            </div>
          </div>
          <div className={SETTINGS_CARD}>
            <div className="flex items-start justify-between gap-6">
              <div>
                <label
                  htmlFor="desktop-auto-update"
                  className="text-sm font-medium"
                >
                  {t("automatic")}
                </label>
                <p
                  id="desktop-auto-update-hint"
                  className="mt-2 max-w-prose text-sm text-[var(--el-muted)]"
                >
                  {t("automaticHint")}
                </p>
              </div>
              <Switch
                id="desktop-auto-update"
                aria-describedby="desktop-auto-update-hint"
                checked={state.automatic}
                disabled={
                  busy ||
                  state.status === "unavailable" ||
                  state.status === "installing"
                }
                onCheckedChange={(enabled) =>
                  bridge &&
                  void run(
                    () => bridge.setAutomaticUpdates(enabled),
                    "automatic"
                  )
                }
              />
            </div>
          </div>
          {state.status === "ready" && !state.canRestart ? (
            <p
              role="alert"
              className="rounded-panel border border-[var(--el-hairline)] bg-[var(--el-canvas-soft)] p-4 text-sm"
            >
              {t("restartBlocked")}
            </p>
          ) : null}
        </div>
      )}
      {failed ? (
        <p role="alert" className="mt-4 text-sm text-destructive">
          {t("failed")}
        </p>
      ) : null}
    </section>
  );
}
