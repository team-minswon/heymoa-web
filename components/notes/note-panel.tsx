"use client";

import { useCallback, useState } from "react";

import { useAuth } from "@/components/auth/auth-provider";
import { useSharedRailSlot } from "@/components/workspace/workspace-app-shell";
import { MeetingControls } from "@/components/notes/meeting-controls";
import { NoteArchive } from "@/components/notes/note-archive";
import {
  NoteColumn,
  NoteHeader,
  NoteTabs,
  NoteTopBar,
} from "@/components/notes/note-chrome";
import {
  NoteDetails,
  NoteDetailsSkeleton,
} from "@/components/notes/note-details";
import { NoteSummary } from "@/components/notes/note-summary";
import { SharedChatPanel } from "@/components/notes/shared-chat-panel";
import { TranscriptView } from "@/components/notes/transcript-view";
import { RecordingDock } from "@/components/transcription/recording-dock";
import {
  isNoteRecordingActive,
  useRecording,
} from "@/components/transcription/recording-provider";
import { Button } from "@/components/ui/button";
import { DataBoundary } from "@/components/ui/data-boundary";
import { InlineRetry } from "@/components/ui/inline-retry";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { useGetNote } from "@/lib/api/generated/notes/notes";
import { useGetProject } from "@/lib/api/generated/projects/projects";
import { deriveMeetingPhase, hasSharedRail } from "@/lib/notes/meeting-state";
import { cn } from "@/lib/utils";

export type NoteTab = "chat" | "details" | "transcript" | "summary";

const NOTE_SAFETY_POLL_MS = 30_000;

export function NotePanel({
  workspaceId,
  noteId,
  view,
  tab,
  onTabChange,
  onViewChange,
  onOpenAgentRail,
  agentRailOpen = false,
  onSharedTurnActiveChange,
  onClose,
  onExpand,
}: {
  workspaceId: string;
  noteId: string;
  view: "side" | "full";
  tab: NoteTab;
  onTabChange: (tab: NoteTab) => void;
  onViewChange?: (view: "side" | "full") => void;
  /** 「내 에이전트」 탭 — 개인 레일을 같은 자리에 세운다. */
  onOpenAgentRail?: () => void;
  agentRailOpen?: boolean;
  onSharedTurnActiveChange?: (active: boolean) => void;
  onClose: () => void;
  onExpand?: () => void;
}) {
  const noteQuery = useGetNote(noteId, {
    query: {
      // 토픽 구독이 조용히 거절되는 server 계약의 복구망. 5초 주 경로는 제거하고
      // 종료 전 상태만 저주기로 확인한다.
      refetchInterval: (query) => {
        const response = query.state.data;
        const note =
          response?.status === 200 && response.data.success
            ? response.data.data
            : undefined;
        return note?.meetingStatus === "ENDED" ? false : NOTE_SAFETY_POLL_MS;
      },
    },
  });
  const note =
    noteQuery.data?.status === 200 && noteQuery.data.data.success
      ? noteQuery.data.data.data
      : undefined;
  const projectQuery = useGetProject(workspaceId, note?.projectId ?? "", {
    query: { enabled: Boolean(note?.projectId) },
  });
  const project =
    projectQuery.data?.status === 200 && projectQuery.data.data.success
      ? projectQuery.data.data.data
      : undefined;

  // 공유 챗봇 트레이는 full 모드에서 회의가 살아 있을 때만(활성·미시작·중지) 선다. 종료되면
  // 우측은 개인 챗봇으로 돌아가고 Q&A는 좌측 아카이브로 접힌다(note-view가 감춤을 푼다).
  const phase = deriveMeetingPhase(note);
  const { user } = useAuth();
  const isStarter = Boolean(
    user && note?.meetingStartedBy?.userId === user.userId
  );
  // 답변이 흐르는 중에 다른 멤버가 회의를 끝내도 트레이를 바로 걷지 않는다 — 언마운트하면
  // 스트림이 끊기고 계약상 부분 응답은 저장되지 않아 답변이 통째로 사라진다. 턴이 끝나면 접는다.
  const [sharedTurnActive, setSharedTurnActive] = useState(false);
  const handleSharedTurnActiveChange = useCallback(
    (active: boolean) => {
      setSharedTurnActive(active);
      onSharedTurnActiveChange?.(active);
    },
    [onSharedTurnActiveChange]
  );
  const noteLoadFailed = noteQuery.isError && !note;
  // 레일에 공유 챗봇 자리가 있는가. **마운트 여부**다 — 보일지는 아래에서 따로 정한다.
  // 흐르던 턴 중에 언마운트하면 계약상 부분 응답이 저장되지 않아 답변이 통째로 사라진다.
  const sharedRailMounted =
    hasSharedRail(view, phase, noteQuery.isPending) || (view === "full" && sharedTurnActive);
  const showSideChatTab =
    view === "side" &&
    !noteLoadFailed &&
    (phase === "active" ||
      phase === "paused" ||
      sharedTurnActive ||
      (phase === "unknown" && tab === "chat"));
  const sideChatNow = view === "side" && tab === "chat";
  const [sideChatVisit, setSideChatVisit] = useState({
    noteId,
    visited: sideChatNow,
  });
  if (
    sideChatVisit.noteId !== noteId ||
    (!sideChatVisit.visited && sideChatNow)
  ) {
    setSideChatVisit({
      noteId,
      visited: sideChatNow,
    });
  }
  const sideChatVisited =
    sideChatNow || (sideChatVisit.noteId === noteId && sideChatVisit.visited);
  const keepSideChatMounted =
    view === "side" &&
    !noteLoadFailed &&
    (tab === "chat" ||
      sharedTurnActive ||
      ((phase === "active" || phase === "paused") && sideChatVisited));
  const showSummaryTab =
    view === "full" ||
    (view === "side" &&
      !noteLoadFailed &&
      (phase === "ended" || (phase === "unknown" && tab === "summary")));
  // 전환을 렌더 중에 접어야 ended 아카이브를 한 번 커밋했다가 읽던 전사를 다시 세우지 않는다.
  const [archiveState, setArchiveState] = useState({
    noteId,
    phase,
    visible: phase === "ended",
  });
  if (archiveState.noteId !== noteId || archiveState.phase !== phase) {
    const viewerEndTransition =
      archiveState.noteId === noteId &&
      archiveState.phase === "active" &&
      phase === "ended" &&
      !isStarter;
    setArchiveState({
      noteId,
      phase,
      visible: phase === "ended" && !viewerEndTransition,
    });
  }
  const archiveQueued =
    phase === "ended" && archiveState.visible && sharedTurnActive;
  const showViewerEndNotice =
    phase === "ended" && !isStarter && (!archiveState.visible || archiveQueued);
  // 종료 아카이브는 흐르던 공유 턴이 끝난 뒤에만 보인다(그 전엔 아직 트레이가 답변을 그린다).
  const showArchive =
    phase === "ended" && archiveState.visible && !sharedTurnActive;

  const recording = useRecording();
  const localProviderCanControlNote =
    isNoteRecordingActive(recording, noteId) &&
    !(recording.phase === "failed" && recording.session?.status === "ACTIVE");
  // 이 노트의 실패이고 서버가 세션 종료를 확인해 준 상태(폴링 reconcile이 INTERRUPTED로
  // 갱신)다. failed+ACTIVE(서버 상태 미확인)·failed+세션 없음은 원격 기록으로 취급해
  // 차단하지만, 죽음이 확인된 실패까지 "다른 탭·기기에서 기록 중"으로 가리면 아무도
  // 기록하지 않는데 그렇게 읽힌다 — 이때는 독의 failed 분기(사유·다시 시도)가 서야 한다.
  const failureSettled =
    recording.phase === "failed" &&
    recording.activeNoteId === noteId &&
    recording.session?.noteId === noteId &&
    recording.session.status === "INTERRUPTED";
  const showDock = Boolean(
    note &&
    (note.meetingStatus === "NOT_STARTED" ||
      (isStarter &&
        (note.meetingStatus === "IN_PROGRESS" ||
          note.meetingStatus === "PAUSED")))
  );
  const startBlockedReason =
    note?.meetingStatus === "IN_PROGRESS" &&
    !localProviderCanControlNote &&
    !failureSettled
      ? "다른 탭·기기에서 기록 중입니다."
      : null;
  const startLabel = note?.meetingStatus === "PAUSED" ? "재개" : "회의 시작";

  // 레일 접기는 사용자 것이다 — 상단바의 토글로 다시 편다.
  const [railCollapsed, setRailCollapsed] = useState(false);
  // 개인 레일이 같은 자리를 쓰는 동안에는 공유 레일을 **감춘다**(언마운트하지 않는다).
  const sharedRailVisible =
    sharedRailMounted && !railCollapsed && !agentRailOpen;
  // 레일이 패널 밖으로 나갔으므로 셸이 그만큼 패널을 좁혀야 한다.
  useSharedRailSlot(sharedRailVisible);

  const tabOptions = [
    ...(showSummaryTab ? [{ key: "summary" as const, label: "요약" }] : []),
    { key: "transcript" as const, label: "전사" },
    ...(showSideChatTab ? [{ key: "chat" as const, label: "챗봇" }] : []),
    { key: "details" as const, label: "정보" },
  ];

  return (
    <div className="flex h-full min-h-0 flex-col bg-card max-lg:landscape:flex-row lg:flex-row">
      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-card">
        {/* full 은 셸이 상단바를 걷었으므로 회의가 자기 상단바를 갖는다(design.pen).
            side 시트는 같은 바를 좁은 폭에서 쓴다 — 「전체 화면으로」가 shrink 자리를 바꿔 든다. */}
        <NoteTopBar
          title={note?.title ?? "회의"}
          onBack={onClose}
          onShrink={view === "full" ? () => onViewChange?.("side") : onExpand}
          shrinkLabel={
            view === "full"
              ? "옆에 열기"
              : sharedTurnActive
                ? "답변이 끝나면 확장할 수 있습니다"
                : "전체 화면으로 보기"
          }
          // 흐르는 답변 중에 확장하면 패널이 갈려 스트림이 끊긴다. 감추지 않고 막는다 —
          // 사라지면 왜 못 하는지가 화면에서 없어진다.
          shrinkDisabled={view === "side" && sharedTurnActive}
          onToggleRail={
            sharedRailMounted
              ? () => setRailCollapsed((collapsed) => !collapsed)
              : undefined
          }
          railOpen={sharedRailVisible}
          actions={
            note ? (
              <MeetingControls
                note={note}
                showContext={view === "side"}
                onMeetingEnded={() => onTabChange("summary")}
              />
            ) : null
          }
        />

        <NoteHeader note={note} projectName={project?.name}>
          <NoteTabs
            value={tab}
            options={tabOptions}
            onChange={(next) => onTabChange(next)}
          />
        </NoteHeader>

        {noteLoadFailed ? (
          <div className="px-4 pt-4 sm:px-8">
            <NoteColumn>
              <InlineRetry
                label="회의 상태를 확인하지 못했습니다."
                onRetry={() => void noteQuery.refetch()}
              />
            </NoteColumn>
          </div>
        ) : null}

        <Tabs
          value={tab}
          onValueChange={(value) => value && onTabChange(value as NoteTab)}
          className="min-h-0 flex-1 gap-0"
        >
          <TabsContent
            value="transcript"
            className="flex min-h-0 flex-1 flex-col"
          >
            {showViewerEndNotice ? (
              <div
                role="region"
                aria-label="회의 종료 안내"
                className="mx-5 mt-4 flex shrink-0 items-center justify-between gap-4 rounded-block border border-[var(--el-hairline)] bg-[var(--el-canvas-soft)] p-3.5 sm:mx-9"
              >
                <div>
                  <p className="text-sm font-medium text-[var(--el-ink)]">
                    회의가 종료되었습니다
                  </p>
                  <p className="mt-0.5 text-xs text-[var(--el-muted)]">
                    읽던 기록을 확인한 뒤 종료된 기록과 요약으로 이동할 수
                    있습니다.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="shrink-0"
                  disabled={archiveQueued}
                  onClick={() =>
                    setArchiveState((current) => ({
                      ...current,
                      visible: true,
                    }))
                  }
                >
                  {archiveQueued
                    ? "답변이 끝나면 이동합니다"
                    : "기록과 요약 보기"}
                </Button>
              </div>
            ) : null}
            <div className="min-h-0 flex-1">
              {/* 종료된 회의는 전사 탭이 아카이브(전사 + 공유 Q&A)가 된다. */}
              {showArchive ? (
                <NoteArchive noteId={noteId} />
              ) : (
                <TranscriptView noteId={noteId} phase={phase} />
              )}
            </div>
          </TabsContent>
          {keepSideChatMounted ? (
            <TabsContent value="chat" keepMounted className="min-h-0 flex-1">
              <SharedChatPanel
                noteId={noteId}
                phase={phase}
                onTurnActiveChange={handleSharedTurnActiveChange}
              />
            </TabsContent>
          ) : null}
          {showSummaryTab ? (
            <TabsContent value="summary" className="min-h-0 flex-1">
              <ScrollArea className="h-full">
                <NoteSummary noteId={noteId} isEnded={phase === "ended"} />
              </ScrollArea>
            </TabsContent>
          ) : null}
          <TabsContent value="details" className="min-h-0 flex-1">
            <ScrollArea className="h-full">
              <DataBoundary
                fallback={<NoteDetailsSkeleton />}
                errorLabel="회의를 불러오지 못했습니다"
                resetKeys={[noteId]}
              >
                <NoteDetails noteId={noteId} />
              </DataBoundary>
            </ScrollArea>
          </TabsContent>
        </Tabs>

        {showDock ? (
          /* 좁은 화면에서는 스크롤을 덮지 않는 footer 레인이고, lg부터 기존처럼 떠 있다. */
          <div className="pointer-events-none z-30 flex shrink-0 justify-center pb-6 pl-5 pr-[84px] sm:px-9 lg:absolute lg:inset-x-0 lg:bottom-6 lg:pb-0">
            <div className="pointer-events-auto min-w-0">
              {/* 독을 숨기지 않는 이유는 왜 못 하는지가 화면에 남아야 하기 때문이다 —
                시작 버튼 자리에 이 문구가 선다. */}
              <RecordingDock
                noteId={noteId}
                disabledReason={startBlockedReason}
                startLabel={startLabel}
              />
            </div>
          </div>
        ) : null}
      </div>

      {sharedRailMounted ? (
        // 넓은 화면에서는 패널 **밖**에 떠 있는 480 레일이다 — 개인 에이전트 레일과 같은
        // 자리·폭·radius·그림자라야 둘이 번갈아 서도 화면이 안 흔들린다(design.pen).
        // 좁은 세로 화면은 본문 아래 스택이고, 짧은 가로 화면은 14rem floor가 전사를
        // 밀어내므로 옆 열로 둔다.
        <div
          className={cn(
            "flex h-[clamp(14rem,36dvh,18rem)] w-full shrink-0 border-t border-[var(--el-hairline)] max-lg:landscape:h-full max-lg:landscape:w-[min(22rem,42vw)] max-lg:landscape:border-l max-lg:landscape:border-t-0 lg:fixed lg:top-2.5 lg:right-2.5 lg:bottom-2.5 lg:z-30 lg:h-auto lg:w-[480px] lg:overflow-hidden lg:rounded-panel lg:border lg:border-[var(--el-hairline)] lg:shadow-e2",
            !sharedRailVisible && "hidden"
          )}
        >
          <SharedChatPanel
            noteId={noteId}
            phase={phase}
            onSelectTab={(tab) => {
              if (tab === "agent") onOpenAgentRail?.();
            }}
            onCloseRail={() => setRailCollapsed(true)}
            onTurnActiveChange={handleSharedTurnActiveChange}
          />
        </div>
      ) : null}
    </div>
  );
}
