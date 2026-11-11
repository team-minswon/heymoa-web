"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import type { DesktopPanelBridge } from "@heymoa/desktop-contracts";
import { useDesktopApp } from "@/lib/desktop/use-desktop-app";
import { Skeleton } from "@/components/ui/skeleton";
import { track } from "@/lib/analytics/track";
import { SettingsHeader, SETTINGS_CARD } from "./settings-layout";

export function DesktopAppearanceSettings() {
  const desktop = useDesktopApp();
  const t = useTranslations("settings.desktopAppearance");
  const [opacity, setOpacity] = useState<number | null>(null);
  const [draft, setDraft] = useState(100);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const bridge =
    typeof window === "undefined"
      ? undefined
      : (window as unknown as { heymoaDesktop?: Partial<DesktopPanelBridge> })
          .heymoaDesktop;
  const supported =
    desktop === true &&
    typeof bridge?.getPanelOpacity === "function" &&
    typeof bridge?.setPanelOpacity === "function";
  useEffect(() => {
    if (!supported) return;
    let live = true;
    void bridge!.getPanelOpacity!()
      .then((value) => {
        if (live) {
          setOpacity(value);
          setDraft(Math.round(value * 100));
        }
      })
      .catch(() => {
        if (live) setFailed(true);
      });
    return () => {
      live = false;
    };
  }, [bridge, supported]);
  async function save(value: number) {
    if (!supported || busy || value === opacity) return;
    setBusy(true);
    setFailed(false);
    try {
      const saved = await bridge!.setPanelOpacity!(value);
      setOpacity(saved);
      track("desktop_panel_opacity_changed", { opacity: saved });
    } catch {
      setDraft(Math.round((opacity ?? 1) * 100));
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="mx-auto max-w-[720px]">
      <SettingsHeader title={t("title")} description={t("description")} />
      <div className={SETTINGS_CARD}>
        {desktop === null ? (
          <Skeleton className="h-16 w-full" />
        ) : !supported ? (
          <p className="text-sm text-[var(--el-muted)]">{t("unavailable")}</p>
        ) : (
          <>
            <div className="flex items-center justify-between gap-4">
              <label htmlFor="desktop-opacity" className="text-sm font-medium">
                {t("opacity")}
              </label>
              <output
                htmlFor="desktop-opacity"
                className="text-sm tabular-nums"
              >
                {draft}%
              </output>
            </div>
            <input
              id="desktop-opacity"
              type="range"
              min="60"
              max="100"
              step="5"
              value={draft}
              disabled={busy || opacity === null}
              aria-describedby="desktop-opacity-hint"
              className="mt-5 w-full accent-[var(--el-ink)]"
              onChange={(event) => setDraft(Number(event.target.value))}
              onPointerUp={() => void save(draft / 100)}
              onKeyUp={() => void save(draft / 100)}
              onBlur={() => void save(draft / 100)}
            />
            <p
              id="desktop-opacity-hint"
              className="mt-3 text-sm leading-6 text-[var(--el-muted)]"
            >
              {t("hint")}
            </p>
          </>
        )}
        {failed ? (
          <p role="alert" className="mt-3 text-sm text-destructive">
            {t("failed")}
          </p>
        ) : null}
      </div>
    </section>
  );
}
