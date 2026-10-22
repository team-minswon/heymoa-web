"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { Check, X } from "lucide-react";

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
  /** 요약을 검토할 끝난 회의(첫 쪽에서 찾은 것). */
  endedNoteId?: string;
  /** 첫 쪽 뒤에 회의가 더 있다. */
  hasMoreNotes: boolean;
  /**
   * 회의 목록을 못 읽었다. 그대로 그리면 기록한 회의가 없는 것처럼 「첫 회의 기록하기」가 미완료로 보여서,
   * 실패는 따로 보이고 다시 읽게 한다(codex 리뷰). 기록이 있는 셈인 단계는 이때 판단하지 않는다.
   */
  retry?: () => void;
};

/**
 * 「시작하기」의 판단·조회·기록. **늘 떠 있는 워크스페이스 셸이 부른다** — 모바일에서는 사이드바가 시트라
 * 닫히면 그 안의 체크리스트가 언마운트되어, 거기서 판단하면 사이드바를 연 적 없는 사람의 첫 판단과 진행
 * 기록을 놓쳤다(codex 리뷰). 열려 있을 때만 그릴 값을 돌려주고, 그리기는 `OnboardingChecklist`가 한다.
 */
export function useOnboardingChecklist({
  workspaceId,
  isWorkspacePending,
}: {
  workspaceId: string;
  isWorkspacePending: boolean;
}): OnboardingChecklistModel | null {
  const userId = useAuth().user?.userId;
  useOnboardingProgress(userId);

  // 서버 스냅숏은 null — 저장소는 브라우저에만 있으니 첫 렌더는 서버와 같이 아무것도 안 그린다.
  const raw = useSyncExternalStore(
    subscribeChecklist,
    () => (userId ? readChecklistRaw(userId) : null),
    () => null
  );
  const state = parseChecklist(raw);
  const undecided = state === null;
  const open = state?.status === "open";
  // 처음 판단할 때 한 번, 그리고 열려 있는 동안만 읽는다. 닫힌 사람(기존 사용자 포함)에게는 안 읽는다.
  // 열려 있으면 목록 화면과 같은 주기로 다시 읽는다 — 그 화면이 다른 범위를 보고 있어도 낡지 않게(codex 리뷰).
  const streamHealthy = useEventStreamHealthy();
  const notesQuery = useNoteListPages({
    scope: { kind: "workspace", workspaceId },
    pages: 1,
    enabled: Boolean(userId) && (undecided || open),
    // 닫혀 있으면 폴링하지 않는다. 열려 있으면 목록 화면과 같은 규칙(PRO-67 I04: 건강한 스트림이면 안전망).
    refetchInterval: open
      ? (notes) => hintedInterval(streamHealthy, noteListRefetchInterval(notes))
      : NO_POLLING,
  });
  // 워크스페이스를 옮기면 `keepPreviousData`가 직전 워크스페이스 목록을 자리표시로 준다 —
  // 그걸로 판단하면 빈 워크스페이스에서 넘어온 사람에게 엉뚱하게 열린다.
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

  // 처음 보는 사람의 판단을 한 번 적어 둔다. 적은 뒤에는 이 판단을 다시 하지 않는다.
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

  // 필수 단계를 **이번에 막 다 마치면** 닫는다 — 혼자 쓰는 사람도 초대 없이 끝난다. 이미 다 마친 채로
  // 「시작 안내 다시 보기」로 연 사람에게는 닫지 않고 「준비가 끝났어요」를 보인다(열자마자 닫히면 안 된다).
  const wasFinished = useRef<boolean | null>(null);
  useEffect(() => {
    // 닫혀 있는 동안 기준을 비운다 — 닫힌 사이 남은 단계를 마치고 다시 열면, 남아 있던 「미완료」를 기준으로
    // 「방금 다 마쳤다」고 잘못 보고 열자마자 닫았다(codex 리뷰). 열릴 때마다 그때 상태부터 다시 잰다.
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

/**
 * 사이드바 아래의 「시작하기」. 첫 요약까지 무엇이 남았는지 한 줄씩 보이고, 줄을 누르면 그 일을
 * 하는 창으로 바로 간다. 빈 워크스페이스의 본문 안내(`WorkspaceOnboarding`)가 「지금 할 한 가지」라면
 * 이건 그 뒤로 이어지는 순서다. 판단은 `useOnboardingChecklist`(셸)가 하고 여기는 그리기만 한다.
 */
export function OnboardingChecklist({
  workspaceId,
  model,
}: {
  workspaceId: string;
  model: OnboardingChecklistModel;
}) {
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
        // 끝난 회의가 있어야 검토할 요약이 있다. 첫 쪽에 없고 뒤에 더 있으면 목록에서 고르게 하고,
        // 아예 없으면 누를 곳이 없다 — 회의부터다.
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
      aria-label="시작하기"
      data-testid="onboarding-checklist"
      className="mx-2 mb-2 rounded-control border border-[var(--el-hairline)] bg-white px-3 pb-2 pt-2.5"
    >
      <div className="flex items-center gap-2">
        <p className="text-[13px] font-semibold text-[var(--el-ink)]">
          {allDone ? "준비가 끝났어요" : "시작하기"}
        </p>
        <span className="text-[11px] font-medium text-[var(--el-muted)]">
          {progress.done}/{progress.total}
        </span>
        <button
          type="button"
          aria-label="시작하기 닫기"
          onClick={dismiss}
          className="ml-auto flex size-6 items-center justify-center rounded-full text-[var(--el-muted)] transition-colors hover:bg-[var(--el-surface-strong)] hover:text-[var(--el-ink)] focus-visible:outline-2 focus-visible:outline-[var(--el-ink)]"
        >
          <X className="size-3.5" aria-hidden />
        </button>
      </div>
      {retry ? (
        <InlineRetry
          variant="line"
          label="진행 상황을 불러오지 못했습니다"
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
                  {step.label}
                </span>
                {step.optional && !isDone ? (
                  <span className="text-[11px] text-[var(--el-muted)]">
                    선택
                  </span>
                ) : null}
                <span className="sr-only">{isDone ? " (완료)" : ""}</span>
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
