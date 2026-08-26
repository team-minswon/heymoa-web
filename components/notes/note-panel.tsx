"use client";

import { useCallback, useState } from "react";
import {
  ArrowLeft,
  Expand,
  MoreHorizontal,
  Shrink,
  Trash2,
} from "lucide-react";

import { useAuth } from "@/components/auth/auth-provider";
import { usePersonalChat } from "@/components/chat/personal-chat";
import {
  MeetingControls,
  MeetingStatusChip,
  MeetingViewerChip,
} from "@/components/notes/meeting-controls";
import { NoteArchive } from "@/components/notes/note-archive";
import {
  NoteDetails,
  NoteDetailsSkeleton,
} from "@/components/notes/note-details";
import { NoteDeleteDialog } from "@/components/notes/note-delete-dialog";
import {
  NoteAgentRail,
} from "@/components/notes/note-agent-rail";
import { NoteParticipantAvatars } from "@/components/notes/note-participants";
import { NoteSummary } from "@/components/notes/note-summary";
import { TranscriptView } from "@/components/notes/transcript-view";
import { RecordingDock } from "@/components/transcription/recording-dock";
import { RecordingDegradedNotice } from "@/components/transcription/recording-degraded-notice";
import {
  isNoteRecordingActive,
  useRecording,
} from "@/components/transcription/recording-provider";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { errorCodeOf } from "@/lib/api/error-message";
import { useGetNote } from "@/lib/api/generated/notes/notes";
import { useGetProject } from "@/lib/api/generated/projects/projects";
import { deriveMeetingPhase } from "@/lib/notes/meeting-state";
import { buildNoteHeaderMeta } from "@/lib/notes/note-header-meta";
import { toNoteMeta } from "@/lib/notes/copy-markdown";
import { cn } from "@/lib/utils";

/** 공유 챗봇이 사라지면서 `chat`이 빠졌습니다 — 대화는 이제 탭이 아니라 레일입니다. */
export type NoteTab = "details" | "transcript" | "summary";

const NOTE_SAFETY_POLL_MS = 30_000;

/**
 * 밑줄 탭 한 칸. 상단바(56) 안에 살아서 높이가 `h-14`다 — 활성 밑줄이 상단바의 hairline
 * 바로 위에 붙어야 「이 바의 어느 칸인가」로 읽힌다.
 *
 * `flex-none`이 핵심이다 — primitive의 기본 트리거는 `flex-1`이라 그대로 두면 셋이 폭을
 * 균등 분할해서 라벨 사이가 200px씩 벌어진다(design.pen은 `w-fit`으로 붙인다).
 */
const TAB_ITEM =
  // 밑줄은 상단바의 hairline **위에** 앉아야 한다. primitive 기본값이 `after:bottom-[-5px]`라
  // 그대로 두면 바 밖으로 5px 떨어져 본문 위에 떠 있는 짧은 막대로 보인다. 덮을 때는 기본값과
  // 같은 variant 셀렉터로 써야 한다 — 평범한 `after:bottom-0`은 조용히 무시된다.
  "h-14 flex-none px-0 text-xs group-data-horizontal/tabs:after:bottom-0";

export function NotePanel({
  workspaceId,
  noteId,
  view,
  tab,
  onTabChange,
  onClose,
  onExpand,
  onCollapse,
  onDeleted,
}: {
  workspaceId: string;
  noteId: string;
  view: "side" | "full";
  tab: NoteTab;
  onTabChange: (tab: NoteTab, options?: { push?: boolean }) => void;
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
    query: {
      enabled: Boolean(note?.projectId),
      // **실패해도 스스로 낫는다.** 이 조회가 노트의 소속을 확인해 주고, 확인 전에는 녹음
      // 시작이 잠긴다. 전역 설정이 `refetchOnWindowFocus: false`라 재시도를 소진한 실패는
      // 재조회 길이 없으면 새로고침 전에는 영영 안 풀린다(codex 6·7회차).
      refetchInterval: (query) =>
        query.state.status === "error" ? NOTE_SAFETY_POLL_MS : false,
    },
  });
  const project =
    projectQuery.data?.status === 200 && projectQuery.data.data.success
      ? projectQuery.data.data.data
      : undefined;

  const phase = deriveMeetingPhase(note);
  // 전사·요약 복사본의 머리말. **여기서 한 번 만든다** — 탭마다 노트를 다시 구독하지
  // 않는다(rule `architecture`).
  const noteMeta = note ? toNoteMeta(note) : null;
  const { user } = useAuth();
  const isStarter = Boolean(
    user && note?.meetingStartedBy?.userId === user.userId
  );
  // 답변이 흐르는 중에 다른 멤버가 회의를 끝내도 트레이를 바로 걷지 않는다 — 언마운트하면
  // 스트림이 끊기고 계약상 부분 응답은 저장되지 않아 답변이 통째로 사라진다. 턴이 끝나면 접는다.
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
  // 개인 챗봇이 한 턴을 굴리는 중이면 레일을 접으면 안 된다 — 중지도 도구 승인도 그 안에만
  // 있는데, 레일이 슬롯을 쥐고 있어 떠 있는 FAB로 되돌아가지도 않는다. 다른 멤버가 회의를
  // 끝내는 순간 좁은 화면에서 답변이 통째로 화면 밖으로 나가던 자리다.
  const { isTurnActive: personalTurnActive } = usePersonalChat();
  // 좁은 화면에서 **대화를 펼칠지**.
  const railLiveNow = meetingLive || phase === "paused" || personalTurnActive;
  /** 한 턴이 도는 중. 뷰를 바꾸면 그 답변에 닿을 길이 끊긴다. */
  const turnActive = personalTurnActive;
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
  const showViewerEndNotice = phase === "ended" && !isStarter && !archiveState.visible;
  // 예전에는 흐르던 **공유** 턴이 끝날 때까지 아카이브를 미뤘다. 개인 대화는 레일에 있고
  // 본문과 자리를 다투지 않으므로 그 대기가 없어졌다.
  const showArchive = phase === "ended" && archiveState.visible;

  /**
   * 요약의 근거 인용이 짚은 전사 세그먼트. 전사 화면이 그 줄로 옮겨 가 잠깐 하이라이트하고,
   * 끝나면 **비운다** — 안 비우면 전사 탭을 다시 열 때마다 같은 자리로 끌려간다.
   * 탭을 옮기는 것도 같은 이유로 비운다(점프는 그 직후 다시 세운다).
   */
  const [focusSegmentId, setFocusSegmentId] = useState<string | null>(null);
  const handleTabChange = useCallback(
    (next: NoteTab) => {
      setFocusSegmentId(null);
      onTabChange(next);
    },
    [onTabChange]
  );
  /**
   * 근거를 눌러 전사로 건너뛴다. **뒤로가기로 읽던 요약에 돌아올 수 있어야 한다** —
   * 각주를 따라간 것이지 탭을 고른 것이 아니라서, 이 이동만 히스토리에 자리를 남긴다.
   */
  const jumpToSegment = useCallback(
    (segmentId: string) => {
      onTabChange("transcript", { push: true });
      setFocusSegmentId(segmentId);
    },
    [onTabChange]
  );
  const clearFocusSegment = useCallback(() => setFocusSegmentId(null), []);
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
  // 이 노트를 녹음 중일 때만 뜬다. 다른 노트의 상태를 여기에 그리면 거짓말이 된다.
  const recordingDegraded =
    recording.activeNoteId === noteId && recording.transcriptionDegraded;

  const showDock = Boolean(
    note &&
    (note.meetingStatus === "NOT_STARTED" ||
      (isStarter &&
        (note.meetingStatus === "IN_PROGRESS" ||
          note.meetingStatus === "PAUSED")))
  );
  /**
   * **이 URL의 워크스페이스가 이 노트의 것이 아니다.**
   *
   * 노트 조회는 워크스페이스로 범위가 좁혀지지 않아 `/w/B/notes/<A의 노트>`도 A의 노트를
   * 그대로 그린다. 그 화면에서 녹음을 시작하면 세션은 A에 생기는데 소속은 B로 기록돼
   * A의 나가기 잠금과 추방 정리가 둘 다 빗나간다. 프로젝트 조회가 그 조합을 판정해 준다 —
   * 서버가 `findByWorkspaceIdAndProjectId` 한 번으로 찾고 없으면 `PROJECT_NOT_FOUND`다.
   * `failureReason`도 본다: `error`는 재시도를 소진해야 채워진다(APP-385).
   */
  const noteNotInThisWorkspace =
    errorCodeOf(projectQuery.error) === "PROJECT_NOT_FOUND" ||
    errorCodeOf(projectQuery.failureReason) === "PROJECT_NOT_FOUND";
  /**
   * 독에 넘길 **확인된 소속.** 서버가 확인해 준 값만 쓴다 — 비어 있으면 독이 시작을 안 연다.
   *
   * **실패했다고 URL의 값으로 대신하면 안 된다.** 조회가 500으로 끝난 채 시작하면 세션은
   * A에 생기는데 소속은 B로 기록된다(codex 7회차 — 6회차 반영에서 한 번 틀린 자리다).
   * 일시적 실패의 복구는 값을 추측하는 것이 아니라 **이유를 보이고 다시 물어보는 것**이다:
   * 아래 `startBlockedReason`이 이유를 세우고, 위 `refetchInterval`이 다시 물어본다.
   */
  const confirmedWorkspaceId = project?.workspaceId;
  const startBlockedReason = noteNotInThisWorkspace
    ? "이 노트는 이 워크스페이스에 없습니다."
    : projectQuery.isError
      ? // 소속 확인 실패는 시작을 잠근다. 이유 없이 잠긴 버튼만 남기지 않는다 — 위
        // `refetchInterval`이 30초마다 다시 확인하므로 문구도 그렇게 말한다.
        "노트 정보를 확인하지 못했습니다. 자동으로 다시 시도합니다."
      : note?.meetingStatus === "IN_PROGRESS" &&
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
  const isViewer = phase === "active" && !isStarter;
  const meta = note ? buildNoteHeaderMeta(note, { isStarter }) : null;
  /**
   * 회의 제어(`MeetingControls`)가 실제로 그릴 것이 있는가. **조건을 여기서 한 번 더 적는
   * 이유는 제어가 제목 블록과 따로 켜지기 때문이다** — 전사·요약에서 제어만 세우려면 그
   * 줄을 그릴지 부모가 알아야 하고, 모르면 회의가 끝난 노트에도 빈 줄이 하나 선다.
   * (`MeetingControls`는 같은 조건에서 `null`을 돌려준다.)
   */
  const canEndMeeting =
    isStarter &&
    (note?.meetingStatus === "IN_PROGRESS" || note?.meetingStatus === "PAUSED");

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
          // 본문 좌우 여백은 **면이 정하고 내용이 읽는다.** design.pen은 side 시트(860)에
          // 좌우 100을, 전체 뷰 본문(970)에 좌우 64를 준다 — 같은 노트인데 두 값이 다르므로
          // 헤더·전사·요약·정보가 각자 하드코딩하면 뷰를 바꿀 때마다 네 군데가 어긋난다.
          // 좁은 화면은 두 뷰가 같다(20 → sm 36).
          "[--note-gutter:20px] sm:[--note-gutter:36px]",
          isFull ? "lg:[--note-gutter:64px]" : "lg:[--note-gutter:100px]",
          paneChrome
        )}
      >
        {/* **`Tabs` 루트가 패널 기둥이다.** 탭 목록이 상단바 안에 있으므로 루트가 상단바까지
            감싸야 한다 — primitive가 `flex flex-col`을 이미 주니 여기서는 채우기만 시킨다. */}
        <Tabs
          value={tab}
          onValueChange={(value) => value && handleTabChange(value as NoteTab)}
          className="min-h-0 flex-1 gap-0"
        >
          {/* **상단바(56)가 노트의 크롬 전부다.** design.pen `KktRX`(side)/`Sghjz`(full).
            안에 이동·창 제어 · 상태 · 제목 빵조각 · **탭** · 노트 메뉴가 다 들어간다.

            탭이 여기 있는 이유는 **탭 줄이 움직이면 안 되기 때문**이다. 전사·요약에서 큰
            제목 블록을 걷어내려면 탭이 그 블록 아래에 있을 수 없다 — 그러면 탭을 누를 때마다
            줄이 141px씩 오르내려 커서 밑에서 버튼이 도망간다. 56 고정인 이 바에 얹으면
            제목 블록이 켜지든 꺼지든 탭은 제자리다.

            상태 칩도 여기다. 전사를 읽는 동안 「지금 실시간인가」는 계속 필요한 정보인데,
            제목 블록과 함께 사라지면 그걸 알 길이 없어진다.

            정본은 전체 뷰 Actions에 알림 벨(`Tc3e6`)을 두었지만 뺐다 — 노트 안에서 알림을
            여는 흐름이 기획에 없고, 열면 이 면 위에 팝오버가 또 뜬다. */}
          <div className="flex h-14 shrink-0 items-center gap-3 border-b border-[var(--el-hairline)] px-4 sm:px-8">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              {/* 이동과 창 제어를 한 그룹으로 묶는다 — 스크린리더에서 「목록으로」와 「전체 화면」이
                제목 빵조각과 섞이면 어느 것이 이동이고 어느 것이 표시인지 알 수 없다. */}
              <div
                role="group"
                aria-label="창 제어"
                className="flex shrink-0 items-center gap-2"
              >
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="rounded-control text-[var(--el-muted)]"
                  aria-label="목록으로"
                  onClick={onClose}
                >
                  <ArrowLeft />
                </Button>
                {onExpand ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="rounded-control text-[var(--el-muted)]"
                    aria-label={
                      turnActive
                        ? "답변이 끝나면 확장할 수 있습니다"
                        : "전체 화면으로 보기"
                    }
                    disabled={turnActive}
                    onClick={onExpand}
                  >
                    <Expand />
                  </Button>
                ) : null}
                {/* 확장과 같은 이유로 답변이 흐르는 동안 막는다 — 축소하면 레일이 슬롯을
                  놓고(`NoteAgentRail`), side에서는 `isPersonalChatHiddenInNote`가 개인
                  패널도 FAB도 감춰서 흐르던 답변의 중지·도구 승인에 닿을 길이 없어진다.
                  계약상 부분 응답은 저장되지 않으므로 놓치면 답변이 통째로 사라진다. */}
                {onCollapse ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="rounded-control text-[var(--el-muted)]"
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
              </div>
              <span
                aria-hidden
                className="h-[18px] w-px shrink-0 bg-[var(--el-hairline)]"
              />
              {/* **아직 없는 값을 그럴듯한 글자로 채우지 않는다.** 예전에는 상태 칩이 없고
                제목이 「회의 노트」였다 — 그 문자열은 이 노트의 이름으로 읽히고, 도착하면
                제목이 칩 폭(41) + gap(8)만큼 오른쪽으로 밀렸다.

                지금은 칩과 제목이 **같은 자리를 잡은 채** 비어 있다. 상태 라벨 넷은 모두
                세 글자(시작 전·기록 중·중지됨·종료됨)라 칩 자리표시가 실제와 같은 폭이다. */}
              {note ? (
                <MeetingStatusChip status={note.meetingStatus} />
              ) : (
                <span
                  aria-hidden
                  className="flex shrink-0 items-center gap-1.5"
                >
                  <Skeleton className="size-1.5 rounded-full" />
                  <Skeleton className="h-3 w-[27px] rounded-chip" />
                </span>
              )}
              {isViewer ? <MeetingViewerChip /> : null}
              {/* 제목은 **지금 어디인지**를 말하는 빵조각이다. 좁아지면 여기가 줄어든다 —
                옆의 상태 칩과 탭은 줄어들 수 없는 것들이다. */}
              {note ? (
                <span className="min-w-0 truncate text-[13px] font-semibold text-[var(--el-ink)]">
                  {note.title}
                </span>
              ) : (
                <Skeleton
                  aria-label="노트 불러오는 중"
                  className="h-3.5 w-40 max-w-full rounded-chip"
                />
              )}
            </div>

            {/* design.pen `U5DbV`/`U9YGl`: **밑줄 탭이다.** 활성 탭만 2px 밑줄을 갖는다.
              전체폭 균등 분할이 아니다 — 탭이 셋~넷뿐인데 폭을 나누면 라벨 사이가 200px씩
              벌어져 한 뭉치로 안 읽힌다(그래서 트리거가 `flex-none`이다).

              순서는 정보 → 전사 → 요약이고 정보가 기본이다. 회의를 열면 먼저 보이는 것이
              제목·참여자·시각이고, 전사는 필요할 때 넘어간다. 라벨은 뷰·상태에 따라 갈리지
              않는다 — 같은 탭이 화면마다 다른 이름으로 불리면 같은 자리인지 알기 어렵다. */}
            {/* 높이를 덮을 때는 `group-data-horizontal/tabs:h-9`처럼 **같은 variant 셀렉터로**
              써야 한다 — primitive의 기본값도 그 형태라(`:h-8`) 평범한 `h-9`는 tailwind-merge가
              충돌로 보지 않아 조용히 무시된다. 여기서는 상단바 높이에 맞춰 `h-14`다. */}
            <TabsList
              variant="line"
              className="shrink-0 gap-5 group-data-horizontal/tabs:h-14"
            >
              <TabsTrigger value="details" className={TAB_ITEM}>
                정보
              </TabsTrigger>
              <TabsTrigger value="transcript" className={TAB_ITEM}>
                전사
              </TabsTrigger>
              {/* 요약은 종료 시 생성되지만 full은 항상 보인다 — 종료 전엔 탭이 안내를 보인다. */}
              {showSummaryTab ? (
                <TabsTrigger value="summary" className={TAB_ITEM}>
                  요약
                </TabsTrigger>
              ) : null}
            </TabsList>

            {/* **회의 종료와 노트 메뉴는 이 한 자리를 나눠 쓴다.** 서로 배타적이라 겹치지
              않는다 — 삭제 메뉴는 기록 중에 숨고(서버가 409로 막으니 눌러서 실패하게 두지
              않는다), 회의 종료는 기록 중·중지됨에만 뜬다. 중지됨에서만 둘이 함께 서는데
              88+32라 860 사이드 시트에서도 넉넉하다.
              전사를 보다가 회의를 끝내는 것은 흔한 일이라 **탭과 무관하게** 여기 있어야 한다. */}
            {note && canEndMeeting ? (
              // **noteId로 키잉한다.** 안 하면 A의 회의 종료 확인창을 연 채 뒤로가기로 B에
              // 왔을 때 이 패널이 재마운트되지 않아 `endOpen`이 남고, 대상만 B로 바뀌어
              // **다른 회의가 종료된다.** 삭제 확인창과 같은 함정이다.
              <MeetingControls
                key={noteId}
                note={note}
                onMeetingEnded={() => onTabChange("summary")}
              />
            ) : null}
            {note && note.meetingStatus !== "IN_PROGRESS" ? (
              <div className="flex shrink-0 items-center gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        aria-label="노트 메뉴"
                        className="rounded-control text-[var(--el-muted)]"
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
              </div>
            ) : null}
          </div>

          {/**
           * 제목 블록은 **정보 탭의 머리글이다** — 노트 전체의 크롬이 아니다.
           *
           * 전사·요약은 읽는 면이고, 여기에 세리프 34 제목(41) + 메타 두 줄(36)이 얹히면
           * 700 패널에서 크롬이 233까지 올라가 본문에 467만 남았다(33%). 그 둘은 **이미 다른
           * 곳에 있다** — 제목은 상단바 빵조각에, 메타는 정보 탭의 「회의 정보」 표에.
           *
           * **회의 제어는 여기 없다** — 상단바 오른쪽에 있다. 전사를 보다가 회의를 끝내는 것은
           * 흔한 일인데, 제목 블록에 묶어 두면 정보 탭까지 다녀와야 한다.
           */}
          {tab === "details" ? (
            <header className="relative z-10 shrink-0 border-b border-[var(--el-hairline)] bg-white px-[var(--note-gutter)] pb-5 pt-5">
              <div className="mx-auto flex w-full max-w-[820px] items-start justify-between gap-4">
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  {project ? (
                    <span className="flex h-5 w-fit shrink-0 items-center rounded-full border border-[var(--el-hairline)] px-2 text-[11px] font-medium text-[var(--el-body)]">
                      {project.name}
                    </span>
                  ) : null}
                  <h1 className="truncate font-serif text-2xl font-light leading-[1.2] tracking-[-0.024em] text-[var(--el-ink)] lg:text-screen-title">
                    {note?.title ?? "회의 노트"}
                  </h1>
                  {meta ? (
                    // 아바타 스택은 목록 행과 같은 컴포넌트다 — 같은 사람인지 알아야 한다.
                    // 링은 캔버스가 아니라 카드 위에 있으므로 흰색이다(정본 `stroke: $--card`).
                    <div className="flex min-w-0 items-center gap-2.5">
                      <NoteParticipantAvatars
                        participants={note?.participants}
                        max={3}
                        size="sm"
                        className="-space-x-1.5 *:data-[slot=avatar]:ring-white"
                      />
                      <p className="min-w-0 text-xs leading-[1.5] text-[var(--el-body)]">
                        <span className="block truncate">
                          {meta.participantLabel
                            ? `${meta.participantLabel} · `
                            : null}
                          {/* 절대 시각은 기계도 읽어야 한다 — 상대 표현("2일 전")은 목록의 몫이다. */}
                          <time dateTime={meta.whenIso}>{meta.whenLabel}</time>
                        </span>
                        <span className="block truncate">{meta.secondary}</span>
                      </p>
                    </div>
                  ) : null}
                </div>
              </div>
            </header>
          ) : null}

          {noteLoadFailed ? (
            <div className="mx-auto w-full max-w-[calc(820px+2*var(--note-gutter))] px-[var(--note-gutter)] pb-4 pt-4">
              <InlineRetry
                label="회의 상태를 확인하지 못했습니다."
                onRetry={() => void noteQuery.refetch()}
              />
            </div>
          ) : null}
          <TabsContent
            value="transcript"
            className="flex min-h-0 flex-1 flex-col"
          >
            {showViewerEndNotice ? (
              <div
                role="region"
                aria-label="회의 종료 안내"
                className="mx-[var(--note-gutter)] mt-4 flex shrink-0 items-center justify-between gap-4 rounded-block border border-[var(--el-hairline)] bg-[var(--el-canvas-soft)] p-3.5"
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
                  disabled={false}
                  onClick={() =>
                    setArchiveState((current) => ({
                      ...current,
                      visible: true,
                    }))
                  }
                >
                  {false
                    ? "답변이 끝나면 이동합니다"
                    : "기록과 요약 보기"}
                </Button>
              </div>
            ) : null}
            <div className="min-h-0 flex-1">
              {/* 종료된 회의는 전사 탭이 아카이브(전사 + 공유 Q&A)가 된다. */}
              {/* 요약 → 전사 점프는 **양쪽 다** 된다. 요약이 있는 상태는 대개 아카이브
                  경로지만, 관전자가 종료 안내에서 아직 넘어가지 않았으면 같은 탭에
                  `TranscriptView`가 서 있다. */}
              {showArchive ? (
                <NoteArchive
                  noteId={noteId}
                  participants={note?.participants ?? []}
                  noteMeta={noteMeta}
                  // 참석자만 화자를 바꾼다. 회의에 없던 사람은 대표 발화를 봐도
                  // 짐작할 근거가 없고, 그런 사람이 이름을 달면 회의록이 조용히 틀린다.
                  canAssignSpeaker={Boolean(
                    user &&
                      note?.participants?.some(
                        (participant) => participant.userId === user.userId
                      )
                  )}
                  focusSegmentId={focusSegmentId}
                  onFocusHandled={clearFocusSegment}
                />
              ) : (
                <TranscriptView
                  noteId={noteId}
                  phase={phase}
                  participants={note?.participants ?? []}
                  noteMeta={noteMeta}
                  focusSegmentId={focusSegmentId}
                  onFocusHandled={clearFocusSegment}
                />
              )}
            </div>
          </TabsContent>
          {showSummaryTab ? (
            <TabsContent value="summary" className="min-h-0 flex-1">
              <ScrollArea className="h-full">
                <NoteSummary
                  noteId={noteId}
                  isEnded={phase === "ended"}
                  noteMeta={noteMeta}
                  onEvidenceSelect={jumpToSegment}
                />
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
            <div className="pointer-events-auto flex min-w-0 flex-col items-center gap-2">
              {/* 자막이 멈춘 이유를 말해 준다. 안 말하면 멀쩡한 녹음을 중단한다. */}
              {recordingDegraded ? <RecordingDegradedNotice /> : null}
              {/* 독을 숨기지 않는 이유는 왜 못 하는지가 화면에 남아야 하기 때문이다 —
                시작 버튼 자리에 이 문구가 선다. */}
              <RecordingDock
                noteId={noteId}
                // **URL이 아니라 확인된 소속을 넘긴다.** 조회가 끝나기 전에는 비어 있고,
                // 독은 그동안 시작을 안 연다 — 확인 전에 누르면 잘못된 워크스페이스로 기록된다.
                workspaceId={confirmedWorkspaceId}
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
          <NoteAgentRail foldedOnNarrow={!railLiveNow} />
        </div>
      ) : null}
    </div>
  );
}
