"use client";

import { useCallback, useState } from "react";
import {
  CalendarDays,
  Expand,
  MoreHorizontal,
  PanelRightClose,
  Shrink,
  Trash2,
} from "lucide-react";

import { useAuth } from "@/components/auth/auth-provider";
import { usePersonalChat } from "@/components/chat/personal-chat";
import { MeetingControls } from "@/components/notes/meeting-controls";
import { NoteArchive } from "@/components/notes/note-archive";
import {
  NoteDetails,
  NoteDetailsSkeleton,
} from "@/components/notes/note-details";
import { NoteDeleteDialog } from "@/components/notes/note-delete-dialog";
import {
  NoteAgentRail,
  type RailTab,
} from "@/components/notes/note-agent-rail";
import { NoteSummary } from "@/components/notes/note-summary";
import { SharedChatPanel } from "@/components/notes/shared-chat-panel";
import { TranscriptView } from "@/components/notes/transcript-view";
import { RecordingDock } from "@/components/transcription/recording-dock";
import {
  isNoteRecordingActive,
  useRecording,
} from "@/components/transcription/recording-provider";
import { Badge } from "@/components/ui/badge";
import { formatAppDate } from "@/lib/format/date";
import { Button } from "@/components/ui/button";
import { DataBoundary } from "@/components/ui/data-boundary";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { InlineRetry } from "@/components/ui/inline-retry";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useGetNote } from "@/lib/api/generated/notes/notes";
import { useGetProject } from "@/lib/api/generated/projects/projects";
import { deriveMeetingPhase } from "@/lib/notes/meeting-state";
import { cn } from "@/lib/utils";

export type NoteTab = "chat" | "details" | "transcript" | "summary";

const NOTE_SAFETY_POLL_MS = 30_000;

export function NotePanel({
  workspaceId,
  noteId,
  view,
  tab,
  onTabChange,
  onSharedTurnActiveChange,
  onClose,
  onExpand,
  onCollapse,
  onDeleted,
}: {
  workspaceId: string;
  noteId: string;
  view: "side" | "full";
  tab: NoteTab;
  onTabChange: (tab: NoteTab) => void;
  onSharedTurnActiveChange?: (active: boolean) => void;
  onClose: () => void;
  onExpand?: () => void;
  /** 전체 화면에서 사이드 뷰로 되돌린다. side에서는 안 준다. */
  onCollapse?: () => void;
  /**
   * 삭제 성공 뒤 이동. **`onClose`를 재사용하면 안 된다** — 닫기는 `push`라 목록에서
   * 뒤로가기를 누르면 방금 지운 노트 URL로 돌아가 404를 만난다. 여기는 `replace`다.
   */
  onDeleted?: () => void;
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

  const phase = deriveMeetingPhase(note);
  const { user } = useAuth();
  const isStarter = Boolean(
    user && note?.meetingStartedBy?.userId === user.userId
  );
  // 답변이 흐르는 중에 다른 멤버가 회의를 끝내도 트레이를 바로 걷지 않는다 — 언마운트하면
  // 스트림이 끊기고 계약상 부분 응답은 저장되지 않아 답변이 통째로 사라진다. 턴이 끝나면 접는다.
  const [sharedTurnActive, setSharedTurnActive] = useState(false);
  /**
   * 삭제 확인창이 **어느 노트의 것인가.** boolean이면 A에서 창을 연 뒤 뒤로가기로 B에 왔을 때
   * 이 패널은 재마운트되지 않아 창이 열린 채 대상만 B로 바뀌고, 확인하면 B가 지워진다.
   * (예전에는 상단바의 노트 액션 슬롯이 `key={noteId}`로 재마운트되며 이걸 막았는데, 제어를
   * 노트 헤더로 옮기면서 그 키가 사라졌다.)
   *
   * 상태에 주어를 담으면 알아서 닫힌다 — 리셋 effect도, 패널 전체 재마운트도 필요 없다.
   */
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  // `open`만 어긋나게 두면 **되돌아왔을 때 창이 되살아난다** — A에서 열고 B에 갔다가 A로
  // 오면 저장된 대상이 아직 A라 확인창이 저절로 뜬다. 렌더 중에 실제로 버린다(이 파일의
  // `sideChatVisit`·`archiveState`와 같은 방식).
  if (deleteTargetId !== null && deleteTargetId !== noteId) {
    setDeleteTargetId(null);
  }
  const handleSharedTurnActiveChange = useCallback(
    (active: boolean) => {
      setSharedTurnActive(active);
      onSharedTurnActiveChange?.(active);
    },
    [onSharedTurnActiveChange]
  );
  const noteLoadFailed = noteQuery.isError && !note;
  // 전체 화면의 레일은 **상주다** — 회의 상태로 여닫지 않고, 닫기 버튼도 없다
  // (design.pen `XtEMZ`/`L4PpR`: 오른쪽 440 고정). 예전에는 회의가 살아 있을 때만 떠서
  // 종료된 노트를 열면 오른쪽이 통째로 사라졌고, 그만큼 본문 폭이 튀었다.
  //
  // **노트를 못 읽었으면 상주도 없다.** 왼쪽은 `InlineRetry`인데 오른쪽 레일이 「회의 상태를
  // 확인하는 중」을 그리면 같은 실패가 두 가지 뜻으로 보인다. side 경로는 이미 같은 조건으로
  // 챗 탭을 뺀다. 캐시가 있으면 `note`가 살아 있어 여기 걸리지 않으므로, 흐르던 스트림이
  // 일시적 조회 실패로 끊기지는 않는다.
  const showSharedTray = view === "full" && !noteLoadFailed;
  // **상주는 넓은 화면 규칙이다.** 정본은 1440 캔버스이고, 좁은 화면에서 레일은 옆이 아니라
  // 본문 아래 14rem 레인으로 눕는다 — 회의가 죽어 있을 때까지 그 레인을 세우면 전사 높이가
  // 0이 된다(모바일 landscape에서 실측). 그래서 좁은 화면에서는 살아 있을 때만 세운다.
  const meetingLive = phase === "active" || phase === "not-started";
  const [railTab, setRailTab] = useState<RailTab>("shared");
  // 개인 챗봇이 한 턴을 굴리는 중이면 레일을 접으면 안 된다 — 중지도 도구 승인도 그 안에만
  // 있는데, 레일이 슬롯을 쥐고 있어 떠 있는 FAB로 되돌아가지도 않는다. 다른 멤버가 회의를
  // 끝내는 순간 좁은 화면에서 답변이 통째로 화면 밖으로 나가던 자리다.
  const { isTurnActive: personalTurnActive } = usePersonalChat();
  // 좁은 화면에서 **대화를 펼칠지**. 접혀도 탭 줄은 남는다 — 통째로 감추면 「내 에이전트」를
  // 고를 버튼까지 감춰져서 종료된 회의에는 들어갈 길이 없어진다(닭이 먼저냐 달걀이 먼저냐).
  const railLiveNow =
    meetingLive ||
    phase === "paused" ||
    sharedTurnActive ||
    railTab === "personal" ||
    personalTurnActive;
  /** 어느 쪽이든 한 턴이 도는 중. 뷰를 바꾸면 그 답변에 닿을 길이 끊긴다. */
  const turnActive = sharedTurnActive || personalTurnActive;
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
  /**
   * **이 창이 방금 이 노트의 세션을 닫았다.** 서버가 종료를 확인해 준 상태(`COMPLETED`)이거나,
   * 죽음이 확인된 실패(`INTERRUPTED`)다.
   *
   * 둘 다 원격 기록으로 취급하면 안 된다. 특히 중지 직후가 그렇다 — 소켓이 `completed`를
   * 주는 순간 phase는 `ACTIVE_PHASES` 밖으로 나가는데 노트 쿼리는 아직 `IN_PROGRESS`라,
   * **중지를 누른 진행자 본인에게 "다른 탭·기기에서 기록 중입니다"가 떴다.** 자기가 방금
   * 끈 것을 남이 켠 것으로 읽던 자리다.
   *
   * `failed`+`ACTIVE`(서버 상태 미확인)와 세션 없는 실패는 여전히 원격으로 본다.
   */
  const finishedHere =
    recording.activeNoteId === noteId &&
    recording.session?.noteId === noteId &&
    ((recording.phase === "completed" &&
      recording.session.status === "COMPLETED" &&
      // **노트가 아직 내 세션을 활성으로 들고 있을 때만**이다. 완료를 영구 예외로 두면,
      // 이 창에서 끈 뒤 다른 탭이 재개했을 때 낡은 로컬 세션이 그 활성 세션을 계속 가려
      // "회의 시작"이 열리고 누르면 409가 난다. 남이 재개하면 노트의 활성 세션 시작 시각이
      // 내 것과 달라지므로 그 순간부터 다시 차단으로 돌아간다.
      // (`isFetching`으로 가리면 30초 안전 폴링마다 그 틈이 다시 열린다.)
      note?.activeSessionStartedAt === recording.session.startedAt) ||
      (recording.phase === "failed" &&
        recording.session.status === "INTERRUPTED"));
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
    !finishedHere
      ? "다른 탭·기기에서 기록 중입니다."
      : null;
  const startLabel = note?.meetingStatus === "PAUSED" ? "재개" : "회의 시작";

  // 전체 화면은 **노트(왼쪽) + 에이전트 레일(오른쪽 고정)** 두 패널이다. 사이는 캔버스 10px,
  // 레일 폭 440 — design.pen `XtEMZ` + `L4PpR`. 레일은 **상주이고 닫기가 없다.**
  const isFull = view === "full";
  const paneChrome = isFull
    ? "rounded-panel border border-[var(--el-hairline)] shadow-e2"
    : "";

  return (
    <div
      className={cn(
        "flex h-full min-h-0 w-full flex-col max-lg:landscape:flex-row lg:flex-row",
        // 캔버스 틈은 넓은 화면 규칙이다 — 좁은 화면에서는 두 면이 테두리로 붙는데 틈까지
        // 두면 붙은 척하면서 벌어진다.
        isFull ? "lg:gap-2.5 lg:bg-transparent" : "bg-white"
      )}
    >
      <div
        className={cn(
          "relative flex min-h-0 flex-1 flex-col overflow-hidden bg-white",
          paneChrome
        )}
      >
        {/* 이제 두 뷰 다 이 헤더가 노트의 크롬이다 — full도 워크스페이스 상단바를 덮으므로
            제목·회의 제어·창 제어가 전부 여기 있어야 한다. 그래서 테두리도 뷰로 가르지 않는다.
            (design.pen `u3yYCX`/`XtEMZ`의 Note Header: 아래 hairline) */}
        <header className="relative z-10 border-b border-[var(--el-hairline)] bg-white/92 px-5 py-4 backdrop-blur-xl sm:px-9 sm:py-5">
          <div className="mx-auto flex w-full max-w-[820px] flex-col gap-3 lg:flex-row lg:items-start lg:gap-4">
            <div className="min-w-0 w-full flex-1 lg:w-auto">
              {/* 회의가 언제 열렸는지는 상세에서만 볼 수 있다 — 목록 계약에는 없다. */}
              {/* 좁은 화면에서는 생성·시작 시각을 접는다 — 정보 탭이 같은 값을 그리고,
                  여기 두면 헤더가 세로로 자라 전사가 눌린다(landscape 355px에서 실측). */}
              <div className="hidden flex-wrap items-center gap-2 lg:flex">
                {project ? (
                  <Badge variant="secondary">{project.name}</Badge>
                ) : null}
                {note?.createdAt ? (
                  <span className="flex items-center gap-1.5 text-xs text-[var(--el-muted)]">
                    <CalendarDays className="size-3.5" />
                    {/* 요일을 Intl에 함께 넘기면 괄호 없이 붙는다 — 목록 헤더와 같은 형식으로 조립한다. */}
                    {formatAppDate(note.createdAt, {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}{" "}
                    ({formatAppDate(note.createdAt, { weekday: "short" })}){" "}
                    {formatAppDate(note.createdAt, {
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </span>
                ) : null}
                {note?.meetingStartedAt ? (
                  <time
                    dateTime={note.meetingStartedAt}
                    className="text-xs text-[var(--el-muted)]"
                  >
                    {formatAppDate(note.meetingStartedAt, {
                      month: "long",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}{" "}
                    시작
                  </time>
                ) : null}
              </div>
              <h1 className="truncate font-serif text-lg font-light leading-tight tracking-[-0.03em] text-[var(--el-ink)] lg:mt-2 lg:text-note-title">
                {note?.title ?? "회의 노트"}
              </h1>
            </div>
            {/* 전체 화면은 워크스페이스 상단바를 통째로 덮으므로 **회의 제어·창 제어를 노트가
                직접 가져야 한다** — 예전에는 상단바의 노트 액션 슬롯이 맡았는데, 그 바가 안
                보이게 되면서 회의 종료·축소가 갈 곳이 없어졌다. side는 계승. */}
            {/* `flex-nowrap`이다 — 전체 화면의 노트 패널은 레일 440을 뺀 나머지라 좁아질 수
                있는데, 여기가 감기면 헤더가 세로로 자라 전사 높이를 0까지 밀어낸다
                (812×375 landscape에서 헤더 278/355 실측). 좁으면 감기지 말고 줄어든다. */}
            <div className="flex w-full min-w-0 flex-wrap items-center justify-between gap-2 lg:w-auto lg:shrink-0 lg:flex-nowrap lg:justify-start">
              {note ? (
                // **noteId로 키잉한다.** 안 하면 A의 회의 종료 확인창을 연 채 뒤로가기로 B에
                // 왔을 때 이 패널이 재마운트되지 않아 `endOpen`이 남고, 대상만 B로 바뀌어
                // **다른 회의가 종료된다.** 삭제 확인창과 같은 함정이고, 예전에는 상단바의
                // 노트 액션 슬롯이 `key={activeNoteId}`로 막던 자리다.
                <MeetingControls
                  key={noteId}
                  note={note}
                  showContext
                  onMeetingEnded={() => onTabChange("summary")}
                />
              ) : null}
              <div
                role="group"
                aria-label="창 제어"
                className="flex shrink-0 items-center gap-1 border-l border-[var(--el-hairline)] pl-2"
              >
                {onExpand ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xl"
                    className="rounded-full"
                    aria-label={
                      sharedTurnActive
                        ? "답변이 끝나면 확장할 수 있습니다"
                        : "전체 화면으로 보기"
                    }
                    disabled={sharedTurnActive}
                    onClick={onExpand}
                  >
                    <Expand />
                  </Button>
                ) : null}
                {/* 확장과 같은 이유로 답변이 흐르는 동안 막는다 — 뷰가 바뀌면 레일의
                    `SharedChatPanel`이 언마운트되고 탭 아래에 새로 마운트되어 SSE가 끊긴다.
                    계약상 부분 응답은 저장되지 않으므로 흐르던 답변이 통째로 사라진다. */}
                {onCollapse ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xl"
                    className="rounded-full"
                    // **개인 챗 턴도 막는다.** 축소하면 레일 슬롯이 사라지고 side에서는
                    // 개인 패널도 FAB도 감춰져서, 흐르던 답변의 중지·도구 승인에 닿을 길이
                    // 없어진다. 공유 턴과 같은 이유다.
                    aria-label={
                      turnActive
                        ? "답변이 끝나면 축소할 수 있습니다"
                        : "사이드 뷰로 보기"
                    }
                    disabled={turnActive}
                    onClick={onCollapse}
                  >
                    <Shrink />
                  </Button>
                ) : null}
                {/* 기록 중이면 서버가 409로 막는다. 눌러서 실패하게 두지 않고 메뉴를 안 그린다.
                    예전에는 이 메뉴가 워크스페이스 상단바의 노트 액션 슬롯에 있었는데, 전체
                    화면이 그 바를 덮게 되면서 갈 곳이 여기가 됐다. */}
                {note && note.meetingStatus !== "IN_PROGRESS" ? (
                  <>
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-xl"
                            aria-label="노트 메뉴"
                            className="rounded-full"
                          />
                        }
                      >
                        <MoreHorizontal />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          variant="destructive"
                          onClick={() => setDeleteTargetId(noteId)}
                        >
                          <Trash2 /> 삭제
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <NoteDeleteDialog
                      noteId={noteId}
                      projectId={note.projectId}
                      title={note.title}
                      open={deleteTargetId === noteId}
                      onOpenChange={(open) =>
                        setDeleteTargetId(open ? noteId : null)
                      }
                      onDeleted={onDeleted ?? onClose}
                    />
                  </>
                ) : null}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xl"
                  className="rounded-full"
                  aria-label="노트 닫기"
                  onClick={onClose}
                >
                  <PanelRightClose />
                </Button>
              </div>
            </div>
          </div>
        </header>

        {noteLoadFailed ? (
          <div className="mx-auto w-full max-w-[820px] px-5 pb-4 sm:px-9">
            <InlineRetry
              label="회의 상태를 확인하지 못했습니다."
              onRetry={() => void noteQuery.refetch()}
            />
          </div>
        ) : null}

        <Tabs
          value={tab}
          onValueChange={(value) => value && onTabChange(value as NoteTab)}
          className="min-h-0 flex-1 gap-0"
        >
          <div className="border-b border-[var(--el-hairline)] bg-white px-5 sm:px-9">
            <div className="mx-auto w-full max-w-[820px]">
              <TabsList
                variant="line"
                className="h-10 w-full justify-start gap-6"
              >
                {/* 순서는 정보 → 스크립트 → 요약이고 정보가 기본이다. 회의를 열면 먼저
                    보이는 것이 제목·참여자·시각이고, 전사는 필요할 때 넘어간다.
                    라벨은 뷰·상태에 따라 갈리지 않는다 — 같은 탭이 화면마다 다른 이름으로
                    불리면(전사/실시간 전사/기록) 같은 자리인지 알기 어렵다. */}
                <TabsTrigger value="details">정보</TabsTrigger>
                <TabsTrigger value="transcript">스크립트</TabsTrigger>
                {/* 요약은 종료 시 생성되지만 full은 항상 보인다 — 종료 전엔 탭이 안내를 보인다. */}
                {showSummaryTab ? (
                  <TabsTrigger value="summary">요약</TabsTrigger>
                ) : null}
                {showSideChatTab ? (
                  <TabsTrigger value="chat">챗봇</TabsTrigger>
                ) : null}
              </TabsList>
            </div>
          </div>
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
                errorLabel="노트를 불러오지 못했습니다"
                resetKeys={[noteId]}
              >
                <NoteDetails noteId={noteId} workspaceId={workspaceId} />
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

      {showSharedTray ? (
        // 넓은 화면은 우측 레일(440 — design.pen `L4PpR`), 좁은 세로 화면은 본문 아래
        // 스택이다. 짧은 가로 화면은 14rem 높이 floor가 전사를 밀어내므로 옆 열로 둔다.
        //
        // 전체 화면에서는 캔버스 10px이 두 패널을 가르므로 **맞닿는 테두리를 두지 않는다** —
        // 두면 틈 양쪽에 선이 하나씩 서서 두 줄로 보인다. 좁은 화면은 틈 없이 붙으므로
        // 그때만 이어 붙이는 선을 남긴다.
        <div
          data-testid="note-agent-rail"
          className={cn(
            "flex h-[clamp(14rem,36dvh,18rem)] w-full shrink-0 flex-col overflow-hidden bg-white max-lg:landscape:h-full max-lg:landscape:w-[min(22rem,42vw)] lg:h-full lg:w-[440px]",
            paneChrome,
            "max-lg:rounded-none max-lg:border-t max-lg:border-[var(--el-hairline)] max-lg:landscape:border-l max-lg:landscape:border-t-0",
            // 접히면 탭 줄 높이만 남는다. 예전에는 `max-lg:hidden`으로 통째로 감췄다.
            !railLiveNow && "max-lg:h-auto max-lg:landscape:h-auto"
          )}
        >
          <NoteAgentRail
            noteId={noteId}
            phase={phase}
            tab={railTab}
            onTabChange={setRailTab}
            foldedOnNarrow={!railLiveNow}
            onSharedTurnActiveChange={handleSharedTurnActiveChange}
          />
        </div>
      ) : null}
    </div>
  );
}
