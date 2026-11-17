"use client";

import { useState } from "react";
import {
  Captions,
  AlertTriangle,
  Check,
  Loader2,
  MessageCircle,
  MicOff,
  MousePointerClick,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

import { useAuthUserId } from "@/components/auth/auth-provider";
import { isWaitingStatus } from "@/components/notes/review/flow-notice";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  ChoiceCards,
  composeFeedback,
  FEEDBACK_MAX,
} from "@/components/workspace/feedback-dialog";
import { track } from "@/lib/analytics/track";
import { useGetAnalysisFlow } from "@/lib/api/generated/analysis/analysis";
import {
  getGetMyFeedbacksQueryKey,
  useCreateFeedback,
} from "@/lib/api/generated/feedbacks/feedbacks";
import { okData } from "@/lib/api/ok-data";
import { readUserFlag, writeUserFlag } from "@/lib/storage/user-flags";
import { toast } from "@/lib/ui/toast";

const DAY_MS = 24 * 60 * 60 * 1000;
const ASK_GAP_MS = 7 * DAY_MS;
const CLOSED_GAP_MS = 14 * DAY_MS;
const MIN_RECORDED_MS = 3 * 60 * 1000;
export const END_FEEDBACK_DELAY_MS = 1000;

const PREFIX = "[회의 종료 후]";
const MESSAGE_MAX = FEEDBACK_MAX - 100;
const REASONS = [
  { value: "recording", tag: "녹음·소리", icon: MicOff },
  { value: "caption", tag: "실시간 자막", icon: Captions },
  { value: "flow", tag: "속도·사용법", icon: MousePointerClick },
  { value: "other", tag: "기타", icon: MessageCircle },
] as const;
type Reason = (typeof REASONS)[number]["value"];

export function claimEndFeedback(
  userId: string | undefined,
  recordedMs: number,
  now = Date.now()
): boolean {
  if (!userId || recordedMs < MIN_RECORDED_MS) return false;
  const off = readUserFlag(userId, "endFeedbackOff");
  const next = readUserFlag(userId, "endFeedbackNextAt");
  if (off === undefined || next === undefined || off === "1") return false;
  if (Number(next ?? 0) > now) return false;
  if (!writeUserFlag(userId, "endFeedbackNextAt", String(now + ASK_GAP_MS)))
    return false;
  track("feedback_opened", { from: "meeting_end" });
  return true;
}

export function MeetingEndFeedback({
  noteId,
  open,
  onClose,
}: {
  noteId: string;
  open: boolean;
  onClose: () => void;
}) {
  const t = useTranslations("notes.endFeedback");
  const userId = useAuthUserId();
  const queryClient = useQueryClient();
  const create = useCreateFeedback({
    mutation: {
      onSuccess: () =>
        void queryClient.invalidateQueries({
          queryKey: getGetMyFeedbacksQueryKey(),
        }),
    },
  });
  const flowQuery = useGetAnalysisFlow(noteId, { query: { enabled: false } });
  const flow = okData(flowQuery.data);
  const [reason, setReason] = useState<Reason | null>(null);
  const [message, setMessage] = useState("");
  const summaryReady = Boolean(
    flow?.regions?.some(
      (row) => row.region === "SUMMARY" && row.status === "SUCCEEDED"
    )
  );
  const settled =
    flow == null
      ? "running"
      : !isWaitingStatus(flow.status) || summaryReady
        ? "ready"
        : flow.status === "ANALYSIS_FAILED"
          ? "failed"
          : "running";
  const progress =
    settled === "running" && flowQuery.isError ? "unknown" : settled;
  const picked = REASONS.find((item) => item.value === reason);
  const reasons = REASONS.map(({ value, icon }) => ({
    value,
    icon,
    label: t(`reasons.${value}.label`),
    hint: t(`reasons.${value}.hint`),
  }));
  const drafting = picked != null || message.trim().length > 0;

  function submit() {
    if (!drafting || create.isPending) return;
    const text = message.trim();
    const body = [picked?.tag, text].filter(Boolean).join("\n");
    create.mutate(
      {
        data: {
          kind: "OTHER",
          message: composeFeedback(`${PREFIX} ${body}`),
        },
      },
      {
        onSuccess: () => {
          toast.success(t("sent"));
          onClose();
        },
      }
    );
  }

  function dismiss(forever: boolean) {
    if (userId) {
      if (forever) writeUserFlag(userId, "endFeedbackOff", "1");
      else
        writeUserFlag(
          userId,
          "endFeedbackNextAt",
          String(Date.now() + CLOSED_GAP_MS)
        );
    }
    track("feedback_dismissed", { from: "meeting_end", forever });
    onClose();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !create.isPending) dismiss(false);
      }}
      disablePointerDismissal={drafting}
    >
      <DialogContent
        overlayClassName="bg-black/40 supports-backdrop-filter:backdrop-blur-none"
        className="max-h-[calc(100dvh-2rem)] gap-0 overflow-y-auto bg-[var(--el-surface-card)] p-7 sm:max-w-[640px]"
      >
        <p
          role="status"
          className="flex items-center gap-2 text-sm text-[var(--el-muted)]"
        >
          {progress === "ready" ? (
            <>
              <Check aria-hidden className="size-4 text-[var(--el-ink)]" />
              {t("progress.ready")}
            </>
          ) : progress === "failed" ? (
            <>
              <AlertTriangle
                aria-hidden
                className="size-4 text-[var(--el-error)]"
              />
              {t("progress.failed")}
            </>
          ) : progress === "unknown" ? (
            <>
              <AlertTriangle aria-hidden className="size-4" />
              {t("progress.unknown")}
            </>
          ) : (
            <>
              <Loader2 aria-hidden className="size-4 animate-spin" />
              {t("progress.running")}
            </>
          )}
        </p>
        <DialogTitle className="mt-4 text-xl">
          {t("title")}
        </DialogTitle>
        <DialogDescription className="mt-1.5 text-sm">
          {t("description")}
        </DialogDescription>

        <div className="mt-6 grid gap-4">
          <ChoiceCards
            label={t("reasonsLabel")}
            items={reasons}
            value={reason}
            onChange={setReason}
          />
          <div>
            <Textarea
              aria-label={t("messageLabel")}
              value={message}
              maxLength={MESSAGE_MAX}
              rows={5}
              className="max-h-60 min-h-32"
              placeholder={
                picked
                  ? t(`reasons.${picked.value}.placeholder`)
                  : t("placeholder")
              }
              onChange={(event) => setMessage(event.target.value)}
            />
            <p className="mt-1 text-right text-[11px] tabular-nums text-[var(--el-muted-soft)]">
              {message.length} / {MESSAGE_MAX}
            </p>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => dismiss(true)}
            className="text-xs text-[var(--el-muted-soft)] underline underline-offset-2 hover:text-[var(--el-ink)]"
          >
            {t("never")}
          </button>
          <div className="flex items-center gap-3">
            <span className="text-xs text-[var(--el-muted-soft)]">
              {t("privacy")}
            </span>
            <Button
              type="button"
              size="lg"
              disabled={!drafting}
              loading={create.isPending}
              onClick={submit}
            >
              {t("send")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
