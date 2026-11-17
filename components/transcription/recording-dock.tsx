"use client";

import { track } from "@/lib/analytics/track";

import { AnimatePresence, motion } from "motion/react";
import { Mic, Pause, RotateCcw, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { formatOffset as formatElapsed } from "@/lib/transcription/presentation";

import {
  isNoteRecordingActive,
  useRecording,
  useRecordingMeter,
} from "@/components/transcription/recording-provider";
import { RecordingPendingSpinner } from "@/components/transcription/recording-pending-spinner";
import { Button } from "@/components/ui/button";
import { useGetRecordingUsage } from "@/lib/api/generated/billing/billing";
import { useGetWorkspace } from "@/lib/api/generated/workspaces/workspaces";
import { okData } from "@/lib/api/ok-data";
import { billingEvents } from "@/lib/billing/analytics";
import { useBillingFormat } from "@/lib/billing/use-billing-format";
import {
  freeUsageLevel,
  RECORDING_USAGE_QUERY,
} from "@/lib/billing/use-recording-usage";
import { pushSettings } from "@/lib/workspace/settings-url";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const LAYOUT_TRANSITION = {
  type: "spring" as const,
  bounce: 0,
  duration: 0.2,
};

const PENDING_HINT_DELAY_MS = 1500;

function PendingStatus({ label }: { label: string }) {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setSlow(true), PENDING_HINT_DELAY_MS);
    return () => clearTimeout(timer);
  }, []);
  return (
    <Tooltip open={slow}>
      <TooltipTrigger
        render={<span className="flex h-9 min-w-0 items-center px-1" />}
      >
        <RecordingPendingSpinner />
        <span role="status" className="sr-only">
          {label}
        </span>
      </TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  );
}

function useQuotaBlock(workspaceId: string | undefined) {
  const t = useTranslations("recording");
  const format = useBillingFormat();
  const usage = okData(
    useGetRecordingUsage(workspaceId ?? "", {
      query: { ...RECORDING_USAGE_QUERY, enabled: Boolean(workspaceId) },
    }).data
  );
  const workspace = okData(
    useGetWorkspace(workspaceId ?? "", {
      query: { enabled: Boolean(workspaceId) },
    }).data
  );
  if (
    !usage?.enforced ||
    usage.unlimited !== false ||
    usage.allowanceMinutes == null ||
    freeUsageLevel(usage).level !== "exhausted"
  )
    return null;
  return {
    reason: t("dock.quotaBlocked", {
      allowance: format.duration(usage.allowanceMinutes),
    }),
    admin: workspace?.role === "ADMIN",
  };
}

export function RecordingDock({
  noteId,
  workspaceId,
  disabledReason = null,
  startLabel: startLabelProp,
  onStart,
}: {
  noteId: string;
  workspaceId: string | undefined;
  disabledReason?: string | null;
  startLabel?: string;
  onStart?: () => void;
}) {
  const t = useTranslations("recording");
  const tActions = useTranslations("common.actions");
  const startLabel = startLabelProp ?? t("dock.start");
  const recording = useRecording();
  const meter = useRecordingMeter();
  const hasActiveSession = recording.activeNoteId
    ? isNoteRecordingActive(recording, recording.activeNoteId)
    : false;
  const isThisNote = recording.activeNoteId === noteId;
  const isOtherNote = hasActiveSession && !isThisNote;
  const state = isThisNote ? recording.phase : "idle";
  const quota = useQuotaBlock(workspaceId);

  return (
    <motion.div
      layout="size"
      layoutDependency={state}
      aria-label={t("dock.label")}
      role="group"
      className="flex h-11 min-w-0 max-w-full items-center overflow-hidden rounded-full border border-[var(--el-hairline)] bg-[color-mix(in_srgb,white_96%,transparent)] p-1 text-[var(--el-ink)] shadow-e2 backdrop-blur-xl"
      style={{ borderRadius: 9999 }}
      transition={LAYOUT_TRANSITION}
    >
      <motion.div
        layout="position"
        layoutDependency={state}
        aria-hidden
        className="flex shrink-0 items-center"
        transition={LAYOUT_TRANSITION}
      >
        <span className="flex size-9 items-center justify-center rounded-full text-[var(--el-muted)]">
          <Mic className="size-4" />
        </span>
        <span className="mx-1 h-5 w-px bg-[var(--el-hairline)]" />
      </motion.div>

      <AnimatePresence mode="popLayout" initial={false}>
        {state === "recording" ? (
          <motion.div
            layout="position"
            layoutDependency={state}
            key="recording"
            initial={{ opacity: 0 }}
            animate={{
              opacity: 1,
              transition: { duration: 0.15, delay: 0.1 },
            }}
            exit={{ opacity: 0, transition: { duration: 0.08 } }}
            className="flex w-max shrink-0 items-center gap-2 pl-2 pr-1"
          >
            <span className="min-w-12 font-mono text-[13px] font-semibold tabular-nums text-destructive">
              {formatElapsed(recording.elapsedMs)}
            </span>
            <span
              role="meter"
              data-testid="note-recording-waveform"
              aria-label={t("micInput")}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(meter.level * 100)}
              className="mx-0.5 flex h-5 w-8 items-center justify-center gap-[3px]"
            >
              {meter.levelHistory.slice(-5).map((sample, index) => (
                <span
                  key={index}
                  className="h-4 w-[3px] origin-center rounded-full bg-destructive transition-transform duration-75"
                  style={{ transform: `scaleY(${Math.max(0.12, sample)})` }}
                />
              ))}
            </span>
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-lg"
                    className="size-9 shrink-0 rounded-full text-[var(--el-muted-soft)] hover:bg-[var(--el-surface-strong)] hover:text-[var(--el-muted)] after:absolute after:-inset-1 after:content-['']"
                    aria-label={t("dock.pause")}
                    onClick={() => {
                      track("recording_stop_clicked", { surface: "note" });
                      void recording.stop();
                    }}
                  />
                }
              >
                <Pause className="size-3.5" aria-hidden />
              </TooltipTrigger>
              <TooltipContent side="right">{t("pause.tooltip")}</TooltipContent>
            </Tooltip>
          </motion.div>
        ) : state === "requesting-permission" ||
          state === "connecting" ||
          state === "stopping" ? (
          <motion.div
            layout="position"
            layoutDependency={state}
            key="pending"
            initial={{ opacity: 0 }}
            animate={{
              opacity: 1,
              transition: { duration: 0.15, delay: 0.1 },
            }}
            exit={{ opacity: 0, transition: { duration: 0.08 } }}
            className="flex h-9 min-w-0 items-center"
          >
            <PendingStatus
              key={state}
              label={
                state === "requesting-permission"
                  ? t("dock.requestingPermission")
                  : state === "connecting"
                    ? t("dock.connecting")
                    : t("dock.stopping")
              }
            />
          </motion.div>
        ) : disabledReason ? (
          <motion.div
            layout="position"
            layoutDependency={state}
            key="blocked"
            initial={{ opacity: 0 }}
            animate={{
              opacity: 1,
              transition: { duration: 0.15, delay: 0.1 },
            }}
            exit={{ opacity: 0, transition: { duration: 0.08 } }}
            className="flex h-9 min-w-0 items-center px-2.5"
          >
            <span className="text-xs leading-snug text-[var(--el-muted)]">
              {disabledReason}
            </span>
          </motion.div>
        ) : quota ? (
          <motion.div
            layout="position"
            layoutDependency={state}
            key="quota"
            initial={{ opacity: 0 }}
            animate={{
              opacity: 1,
              transition: { duration: 0.15, delay: 0.1 },
            }}
            exit={{ opacity: 0, transition: { duration: 0.08 } }}
            className="flex h-9 min-w-0 items-center gap-2 pr-1 pl-1"
          >
            <button
              type="button"
              disabled
              aria-label={startLabel}
              className="flex size-9 shrink-0 cursor-not-allowed items-center justify-center rounded-full bg-destructive opacity-45"
            >
              <span className="size-2.5 rounded-full bg-white" aria-hidden />
            </button>
            <span
              role="status"
              className="min-w-0 text-xs leading-snug text-[var(--el-muted)]"
            >
              {quota.reason}
              {quota.admin ? null : ` ${t("dock.quotaAskAdmin")}`}
            </span>
            {quota.admin ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-9 shrink-0 rounded-full px-3 text-xs"
                onClick={() => {
                  if (workspaceId)
                    billingEvents.quotaUpgradeClicked(workspaceId);
                  pushSettings("billing");
                }}
              >
                {t("dock.quotaPlans")}
              </Button>
            ) : null}
          </motion.div>
        ) : state === "failed" ? (
          <motion.div
            layout="position"
            layoutDependency={state}
            key="failed"
            initial={{ opacity: 0 }}
            animate={{
              opacity: 1,
              transition: { duration: 0.15, delay: 0.1 },
            }}
            exit={{ opacity: 0, transition: { duration: 0.08 } }}
            className="flex h-9 shrink-0 items-center gap-1 px-1"
          >
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-9 shrink-0 rounded-full px-3 text-xs after:absolute after:-inset-1 after:content-['']"
              disabled={isOtherNote || !workspaceId}
              onClick={() => {
                if (!workspaceId) return;
                track("recording_start_clicked", {
                  workspace_id: workspaceId,
                  retry: true,
                });
                void recording.start(noteId, workspaceId);
              }}
            >
              <RotateCcw className="size-3.5" />
              {t("dock.retry")}
            </Button>
            {!isNoteRecordingActive(recording, noteId) ? (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={tActions("close")}
                className="size-9 shrink-0 rounded-full text-[var(--el-muted-soft)] hover:text-[var(--el-muted)] after:absolute after:-inset-1 after:content-['']"
                onClick={() => void recording.disconnect()}
              >
                <X className="size-3.5" />
              </Button>
            ) : null}
          </motion.div>
        ) : (
          <motion.div
            layout="position"
            layoutDependency={state}
            key="idle"
            initial={{ opacity: 0 }}
            animate={{
              opacity: 1,
              transition: { duration: 0.15, delay: 0.1 },
            }}
            exit={{ opacity: 0, transition: { duration: 0.08 } }}
            className="flex shrink-0 items-center px-1"
          >
            <Tooltip>
              <TooltipTrigger
                render={
                  <button
                    type="button"
                    className="relative flex size-9 items-center justify-center rounded-full bg-destructive shadow-sm transition-colors hover:bg-destructive/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive/50 disabled:cursor-not-allowed disabled:opacity-45 after:absolute after:-inset-1 after:content-['']"
                    aria-label={isOtherNote ? t("dock.otherNote") : startLabel}
                    disabled={isOtherNote || !workspaceId}
                    onClick={() => {
                      if (!workspaceId) return;
                      track("recording_start_clicked", {
                        workspace_id: workspaceId,
                        retry: false,
                      });
                      void recording.start(noteId, workspaceId);
                      onStart?.();
                    }}
                  />
                }
              >
                <span className="size-2.5 rounded-full bg-white" aria-hidden />
              </TooltipTrigger>
              <TooltipContent side="right">{startLabel}</TooltipContent>
            </Tooltip>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
