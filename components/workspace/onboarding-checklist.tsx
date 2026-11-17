"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { Check, X } from "lucide-react";
import { useTranslations } from "next-intl";

import { useAuth } from "@/components/auth/auth-provider";
import { useWorkspaceShell } from "@/components/workspace/workspace-app-shell";
import { noteListRefetchInterval } from "@/components/workspace/workspace-page";
import { track } from "@/lib/analytics/track";
import {
  CHECKLIST_STEPS,
  completedSteps,
  firstChecklistStatus,
  hasRecordedMeeting,
  isChecklistVisible,
  parseChecklist,
  readChecklistRaw,
  requiredProgress,
  subscribeChecklist,
  updateChecklist,
  writeChecklist,
  type ChecklistStepId,
} from "@/lib/onboarding/checklist";
import { useOnboardingProgress } from "@/lib/onboarding/use-onboarding-progress";
import { InlineRetry } from "@/components/ui/inline-retry";
import { cn } from "@/lib/utils";
import { useNoteListPages } from "@/lib/workspace/use-note-list-pages";
import { useEventStreamHealthy } from "@/lib/events/health";
import { hintedInterval } from "@/lib/events/interval";

const NO_POLLING = () => 0;

export type OnboardingChecklistModel = {
  userId: string;
  done: Set<ChecklistStepId>;
  endedNoteId?: string;
  hasMoreNotes: boolean;
  retry?: () => void;
};

export function useOnboardingChecklist({
  workspaceId,
  isWorkspacePending,
}: {
  workspaceId: string;
  isWorkspacePending: boolean;
}): OnboardingChecklistModel | null {
  const userId = useAuth().user?.userId;
  useOnboardingProgress(userId);

  const raw = useSyncExternalStore(
    subscribeChecklist,
    () => (userId ? readChecklistRaw(userId) : null),
    () => null
  );
  const state = parseChecklist(raw);
  const undecided = state === null;
  const open = state?.status === "open";
  const streamHealthy = useEventStreamHealthy();
  const notesQuery = useNoteListPages({
    scope: { kind: "workspace", workspaceId },
    pages: 1,
    enabled: Boolean(userId) && (undecided || open),
    refetchInterval: open
      ? (notes) => hintedInterval(streamHealthy, noteListRefetchInterval(notes))
      : NO_POLLING,
  });
  const page =
    !notesQuery.isPlaceholderData &&
    notesQuery.data?.status === 200 &&
    notesQuery.data.data.success
      ? notesQuery.data.data.data
      : undefined;
  const facts =
    isWorkspacePending || !page
      ? null
      : {
          hasRecording: hasRecordedMeeting(page),
        };
  const factsReady = facts !== null;
  const hasRecording = facts?.hasRecording ?? false;

  useEffect(() => {
    if (!userId || !undecided || !factsReady) return;
    writeChecklist(userId, {
      status: firstChecklistStatus({ hasRecording }),
      done: [],
    });
  }, [userId, undecided, factsReady, hasRecording]);

  const done = completedSteps(state, facts ?? { hasRecording: false });
  const progress = requiredProgress(done);
  const finished = progress.done === progress.total;

  const wasFinished = useRef<boolean | null>(null);
  useEffect(() => {
    if (!userId || !open) {
      wasFinished.current = null;
      return;
    }
    if (!factsReady) return;
    if (wasFinished.current === false && finished) {
      track("onboarding_completed");
      updateChecklist(userId, (current) => ({
        status: "dismissed",
        done: current?.done ?? [],
      }));
    }
    wasFinished.current = finished;
  }, [userId, open, factsReady, finished]);

  const failed = notesQuery.isError && !page;
  if (!userId || !isChecklistVisible(state, failed)) return null;
  return {
    userId,
    done,
    endedNoteId: page?.notes.find((note) => note.meetingStatus === "ENDED")
      ?.noteId,
    hasMoreNotes: page?.hasMore ?? false,
    retry: failed ? () => void notesQuery.refetch() : undefined,
  };
}

export function OnboardingChecklist({
  workspaceId,
  model,
}: {
  workspaceId: string;
  model: OnboardingChecklistModel;
}) {
  const t = useTranslations("workspace.checklist");
  const router = useRouter();
  const { requestNewMeeting, openSettings } = useWorkspaceShell();
  const { userId, done, endedNoteId, hasMoreNotes, retry } = model;
  const progress = requiredProgress(done);
  const allDone = progress.done === progress.total;

  const actionOf = (id: ChecklistStepId): (() => void) | undefined => {
    switch (id) {
      case "record":
        return requestNewMeeting;
      case "confirm":
        if (endedNoteId) {
          return () =>
            router.push(
              `/w/${workspaceId}/notes/${endedNoteId}?view=full&tab=summary`
            );
        }
        return hasMoreNotes
          ? () => router.push(`/w/${workspaceId}`)
          : undefined;
      case "invite":
        return () => openSettings("members");
    }
  };

  const dismiss = () => {
    track("onboarding_dismissed", { done: done.size });
    updateChecklist(userId, (current) => ({
      status: "dismissed",
      done: current?.done ?? [],
    }));
  };

  return (
    <section
      aria-label={t("title")}
      data-testid="onboarding-checklist"
      className="mx-2 mb-2 rounded-control border border-[var(--el-hairline)] bg-white px-3 pb-2 pt-2.5"
    >
      <div className="flex items-center gap-2">
        <p className="text-[13px] font-semibold text-[var(--el-ink)]">
          {allDone ? t("allDone") : t("title")}
        </p>
        <span className="text-[11px] font-medium text-[var(--el-muted)]">
          {progress.done}/{progress.total}
        </span>
        <button
          type="button"
          aria-label={t("dismiss")}
          onClick={dismiss}
          className="ml-auto flex size-6 items-center justify-center rounded-full text-[var(--el-muted)] transition-colors hover:bg-[var(--el-surface-strong)] hover:text-[var(--el-ink)] focus-visible:outline-2 focus-visible:outline-[var(--el-ink)]"
        >
          <X className="size-3.5" aria-hidden />
        </button>
      </div>
      {retry ? (
        <InlineRetry
          variant="line"
          label={t("loadFailed")}
          onRetry={retry}
          className="mt-2 pb-1"
        />
      ) : (
        <ol className="mt-1.5 flex flex-col">
          {CHECKLIST_STEPS.map((step) => {
            const isDone = done.has(step.id);
            const action = isDone ? undefined : actionOf(step.id);
            const content = (
              <>
                <span
                  aria-hidden
                  className={cn(
                    "flex size-4 shrink-0 items-center justify-center rounded-full border",
                    isDone
                      ? "border-[var(--el-ink)] bg-[var(--el-ink)] text-white"
                      : "border-[var(--el-hairline-strong)]"
                  )}
                >
                  {isDone && <Check className="size-2.5" strokeWidth={3} />}
                </span>
                <span
                  className={cn(
                    isDone && "text-[var(--el-muted)] line-through"
                  )}
                >
                  {t(`steps.${step.id}`)}
                </span>
                {step.optional && !isDone ? (
                  <span className="text-[11px] text-[var(--el-muted)]">
                    {t("optional")}
                  </span>
                ) : null}
                <span className="sr-only">{isDone ? t("doneSuffix") : ""}</span>
              </>
            );
            return (
              <li key={step.id}>
                {action ? (
                  <button
                    type="button"
                    onClick={action}
                    className="flex h-7 w-full items-center gap-2 rounded-control px-1 text-left text-[13px] text-[var(--el-ink)] transition-colors hover:bg-[var(--el-surface-strong)] focus-visible:outline-2 focus-visible:outline-[var(--el-ink)]"
                  >
                    {content}
                  </button>
                ) : (
                  <div className="flex h-7 items-center gap-2 px-1 text-[13px] text-[var(--el-body)]">
                    {content}
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
