"use client";

import { Check, ChevronLeft, ChevronRight, Minus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { DesktopDownloadLink } from "@/components/heymoa/desktop-download-link";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

function SoundComparison() {
  const t = useTranslations("shell.desktopCompare.table");
  return (
    <table className="w-full table-fixed border-collapse text-[15px]">
      <caption className="sr-only">{t("caption")}</caption>
      <thead>
        <tr className="border-b border-[var(--el-hairline)] text-[13px] text-[var(--el-muted)]">
          <th scope="col" className="w-[56%] pb-3 text-left font-normal">
            {t("sound")}
          </th>
          <th scope="col" className="pb-3 text-center font-normal">
            {t("web")}
          </th>
          <th
            scope="col"
            className="pb-3 text-center font-semibold text-[var(--el-ink)]"
          >
            {t("app")}
          </th>
        </tr>
      </thead>
      <tbody>
        <tr className="border-b border-[var(--el-hairline)]">
          <th
            scope="row"
            className="py-5 pr-3 text-left align-middle font-medium text-[var(--el-ink)]"
          >
            {t("mic")}
            <span className="mt-1 block text-[13px] leading-5 font-normal text-[var(--el-muted)]">
              {t("micExamples")}
            </span>
          </th>
          <td className="text-center">
            <Check aria-hidden className="mx-auto size-5" />
            <span className="sr-only">{t("supported")}</span>
          </td>
          <td className="text-center">
            <Check aria-hidden className="mx-auto size-5" />
            <span className="sr-only">{t("supported")}</span>
          </td>
        </tr>
        <tr className="border-b border-[var(--el-hairline)]">
          <th
            scope="row"
            className="py-5 pr-3 text-left align-middle font-medium text-[var(--el-ink)]"
          >
            {t("system")}
            <span className="mt-1 block text-[13px] leading-5 font-normal text-[var(--el-muted)]">
              {t("systemExamples")}
            </span>
          </th>
          <td className="text-center text-[var(--el-muted)]">
            <Minus aria-hidden className="mx-auto size-5" />
            <span className="sr-only">{t("unsupported")}</span>
          </td>
          <td className="text-center">
            <Check aria-hidden className="mx-auto size-5" />
            <span className="sr-only">{t("supported")}</span>
          </td>
        </tr>
      </tbody>
    </table>
  );
}

const STEPS = ["sound", "background", "sameData"] as const;

export function DesktopCompareDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("shell.desktopCompare");
  const [index, setIndex] = useState(0);
  const step = STEPS[index];
  const change = (next: boolean) => {
    if (!next) setIndex(0);
    onOpenChange(next);
  };
  return (
    <Dialog open={open} onOpenChange={change}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] gap-0 overflow-y-auto bg-white p-6 sm:max-w-[600px] sm:p-8">
        <DialogHeader className="h-[108px] gap-2 pr-6 sm:h-[64px]">
          <DialogTitle className="text-[24px] leading-tight font-light tracking-tight">
            {t(`steps.${step}.title`)}
          </DialogTitle>
          <DialogDescription>
            {t(`steps.${step}.description`)}
          </DialogDescription>
        </DialogHeader>
        <div
          className="mt-6 h-[308px] overflow-y-auto"
          role="group"
          aria-label={t("stepGroup", { current: index + 1, total: STEPS.length })}
        >
          {index === 0 ? (
            <SoundComparison />
          ) : index === 1 ? (
            <div>
              <div
                role="img"
                aria-label={t("menuBar.label")}
                className="overflow-hidden rounded-control border border-[var(--el-hairline)] bg-[var(--el-canvas-soft)]"
              >
                <div
                  aria-hidden
                  className="flex h-9 items-center justify-between border-b border-[var(--el-hairline)] bg-white px-3 text-xs text-[var(--el-muted)]"
                >
                  <span>{t("menuBar.name")}</span>
                  <span className="inline-flex items-center gap-2 rounded-chip bg-[var(--el-surface-strong)] px-2 py-1 text-[var(--el-ink)]">
                    <span className="size-1.5 rounded-full bg-red-500" />
                    {t("menuBar.recording")}
                  </span>
                </div>
                <div aria-hidden className="px-6 pt-4 pb-9 sm:px-7">
                  <div className="ml-auto w-[90%] rounded-control border border-[var(--el-hairline)] bg-white p-3 shadow-sm sm:w-[84%]">
                    <p className="text-sm font-medium">
                      {t("menuBar.meeting")}{" "}
                      <span className="ml-1 font-normal text-[var(--el-muted)]">
                        {t("menuBar.timeline")}
                      </span>
                    </p>
                    <div className="mt-2.5 space-y-2.5 border-t border-[var(--el-hairline)] pt-2.5 text-[13px]">
                      <p className="flex gap-3">
                        <span className="shrink-0 text-[var(--el-muted)]">
                          00:32
                        </span>
                        <span>{t("menuBar.item1")}</span>
                      </p>
                      <p className="flex gap-3">
                        <span className="shrink-0 text-[var(--el-muted)]">
                          01:10
                        </span>
                        <span>{t("menuBar.item2")}</span>
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              <p className="mt-3 text-sm leading-6 text-[var(--el-muted)]">
                {t("menuBar.keepsRecording")}
                <span className="block">
                  {t("menuBar.checkMenuBar")}
                </span>
              </p>
            </div>
          ) : (
            <div>
              <p className="text-[15px] leading-6">
                {t("install.body")}
              </p>
              <dl className="my-5 divide-y divide-[var(--el-hairline)] text-sm">
                <div className="flex justify-between gap-4 py-3">
                  <dt className="font-medium">Mac</dt>
                  <dd className="text-[var(--el-muted)]">
                    {t("install.macRequirement")}
                  </dd>
                </div>
                <div className="flex justify-between gap-4 py-3">
                  <dt className="font-medium">Windows</dt>
                  <dd className="text-[var(--el-muted)]">Windows 11 x64</dd>
                </div>
              </dl>
              <DesktopDownloadLink
                className={cn(
                  buttonVariants({ variant: "default" }),
                  "h-10 px-4"
                )}
              />
            </div>
          )}
        </div>
        <div className="mt-5 flex items-center justify-between gap-1 border-t border-[var(--el-hairline)] pt-5">
          <nav
            aria-label={t("stepNav")}
            className="flex shrink-0 items-center gap-1"
          >
            {STEPS.map((item, i) => (
              <Button
                variant="ghost"
                size="icon-sm"
                key={item}
                type="button"
                aria-current={index === i ? "step" : undefined}
                aria-label={t("stepLabel", {
                  number: i + 1,
                  title: t(`steps.${item}.title`),
                })}
                onClick={() => setIndex(i)}
                className={cn(
                  "size-7 shrink-0 rounded-full border p-0 text-[13px] leading-none font-medium tabular-nums",
                  index === i
                    ? "border-[var(--el-ink)] bg-[var(--el-ink)] text-white hover:bg-[var(--el-ink)] hover:text-white"
                    : "border-[var(--el-hairline)] bg-white text-[var(--el-muted)] hover:bg-[var(--el-surface-strong)]"
                )}
              >
                {i + 1}
              </Button>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="w-[68px] text-sm"
              disabled={index === 0}
              onClick={() => setIndex(index - 1)}
            >
              <ChevronLeft aria-hidden />
              {t("previous")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="w-[68px] text-sm"
              onClick={() =>
                index === STEPS.length - 1 ? change(false) : setIndex(index + 1)
              }
            >
              {index === STEPS.length - 1 ? t("done") : t("next")}
              {index < STEPS.length - 1 ? <ChevronRight aria-hidden /> : null}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
