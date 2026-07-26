"use client";

import { useState } from "react";
import { CalendarDays, Expand, PanelRightClose } from "lucide-react";

import { NoteArchive } from "@/components/notes/note-archive";
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
import { Badge } from "@/components/ui/badge";
import { formatAppDate } from "@/lib/format/date";
import { Button } from "@/components/ui/button";
import { DataBoundary } from "@/components/ui/data-boundary";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useGetNote } from "@/lib/api/generated/notes/notes";
import { useGetProject } from "@/lib/api/generated/projects/projects";
import {
  deriveMeetingPhase,
  meetingRefetchInterval,
} from "@/lib/notes/meeting-state";
import { cn } from "@/lib/utils";

export type NoteTab = "details" | "transcript" | "summary";

export function NotePanel({
  workspaceId,
  noteId,
  view,
  tab,
  onTabChange,
  onClose,
  onExpand,
}: {
  workspaceId: string;
  noteId: string;
  view: "side" | "full";
  tab: NoteTab;
  onTabChange: (tab: NoteTab) => void;
  onClose: () => void;
  onExpand?: () => void;
}) {
  // 다른 멤버가 회의를 시작·중지·재개·종료하면 게이트가 따라가야 한다. 전역 쿼리 클라이언트는
  // 포커스 refetch를 꺼 두므로 여기서 폴링한다 — 종료되면 멈춘다.
  const noteQuery = useGetNote(noteId, {
    query: {
      refetchInterval: (query) => {
        const payload = query.state.data;
        const current =
          payload?.status === 200 && payload.data.success
            ? payload.data.data
            : undefined;
        return meetingRefetchInterval(current);
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
  // 답변이 흐르는 중에 다른 멤버가 회의를 끝내도 트레이를 바로 걷지 않는다 — 언마운트하면
  // 스트림이 끊기고 계약상 부분 응답은 저장되지 않아 답변이 통째로 사라진다. 턴이 끝나면 접는다.
  const [sharedTurnActive, setSharedTurnActive] = useState(false);
  const meetingLive = phase === "active" || phase === "not-started";
  const showSharedTray = view === "full" && (meetingLive || sharedTurnActive);
  // 종료 아카이브는 흐르던 공유 턴이 끝난 뒤에만 보인다(그 전엔 아직 트레이가 답변을 그린다).
  const showArchive = phase === "ended" && !sharedTurnActive;

  // v5 side 프레임 셋(`oLmGL`·`viNgv`·`KCoyt`)에는 레코더 독도 회의 조작도 없다. side는
  // 읽기·미리보기 면이고 주 액션은 `확장`이다 — full 프레임(`Ftvu9`)에만 둘 다 있다.
  //
  // **다만 도는 녹음은 남긴다.** 전역 녹음 필은 `!isWorkspaceRoute`라 워크스페이스 안에서는
  // 안 뜬다. full에서 시작하고 side로 오면 독까지 없앨 때 멈출 방법이 하나도 없다.
  // (프레임 셋이 전부 종료된 회의라 "라이브를 side로 볼 때"는 그려진 적이 없다 — 추론이다.)
  //
  // 판정은 `isNoteRecordingActive`를 쓴다. `activeNoteId`는 종료 뒤에도 남고 phase가
  // `completed`·`failed`로 가므로 "idle이 아님"으로 보면 끝난 녹음에도 독이 다시 서서
  // side에서 시작 버튼이 살아난다. 그 함수는 진행 phase와 **서버 세션이 아직 열린** failed만
  // 활성으로 본다 — 후자는 정리할 세션이 남아 있어 독이 필요한 경우다.
  const recording = useRecording();
  const showDock = view === "full" || isNoteRecordingActive(recording, noteId);

  // 종료된 회의는 전사를 다시 시작할 수 없다 — 종료 다이얼로그가 그렇게 약속하고, 종료가
  // 분석을 만들었으므로 이후 전사가 늘면 이미 나온 요약과 어긋난다.
  //
  // **상태를 모르는 동안에도 열지 않는다.** 콜드 캐시나 느린 응답에서는 `note`가 아직
  // undefined인데, 그때 시작 버튼이 살아 있으면 종료된 회의에 세션이 붙는다. 계약의
  // 계약의 409에 `MEETING_ALREADY_ENDED`가 생겼다(APP-214). 다만 여기는 **요청이 나가기 전**
  // 차단 사유라 서버 문구가 도달하지 않는다 — 첫 문장은 계약과 같게 두고(`이미 종료된
  // 회의입니다.`) 왜 못 하는지를 덧붙인다. 실제로 요청이 실패하는 경로는 `errorMessageOf`가
  // 서버 문구를 그대로 쓴다.
  const startBlockedReason =
    note?.meetingStatus === "ENDED"
      ? "이미 종료된 회의입니다. 전사를 다시 시작할 수 없습니다."
      : note
        ? null
        : noteQuery.isError
          ? "회의 상태를 확인하지 못했습니다."
          : "회의 상태를 확인하는 중입니다.";

  return (
    <div className="flex h-full min-h-0 flex-col bg-white lg:flex-row">
      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-white">
        {/* full은 상단바가 브레드크럼·노트 액션을 맡으므로 여기선 바 테두리 없이 제목만(본문 블록).
          side 시트는 자체 헤더 바(제목 + 전체화면·닫기)를 유지한다(계승). */}
        <header
          className={cn(
            "relative z-10 px-5 py-4 sm:px-9 sm:py-5",
            view === "side" &&
              "border-b border-[var(--el-hairline)] bg-white/92 backdrop-blur-xl"
          )}
        >
          <div className="mx-auto flex w-full max-w-[820px] items-start gap-4">
            <div className="min-w-0 flex-1">
              {/* 회의가 언제 열렸는지는 상세에서만 볼 수 있다 — 목록 계약에는 없다. */}
              <div className="flex flex-wrap items-center gap-2">
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
              </div>
              <h1 className="mt-2 truncate font-serif text-note-title font-light leading-tight tracking-[-0.03em] text-[var(--el-ink)]">
                {note?.title ?? "회의 노트"}
              </h1>
            </div>
            {view === "side" ? (
              <div className="flex shrink-0 items-center gap-2">
                {onExpand ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-lg"
                    className="rounded-full"
                    aria-label="전체 화면으로 보기"
                    onClick={onExpand}
                  >
                    <Expand />
                  </Button>
                ) : null}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-lg"
                  className="rounded-full"
                  aria-label="노트 닫기"
                  onClick={onClose}
                >
                  <PanelRightClose />
                </Button>
              </div>
            ) : null}
          </div>
        </header>

        <Tabs
          value={tab}
          onValueChange={(value) => value && onTabChange(value as NoteTab)}
          className="min-h-0 flex-1 gap-0"
        >
          <div className="border-b border-[var(--el-hairline)] bg-white px-5 sm:px-9">
            <div className="mx-auto w-full max-w-[820px]">
              <TabsList
                variant="line"
                className="h-11 w-full justify-start gap-6"
              >
                <TabsTrigger value="transcript">실시간 전사</TabsTrigger>
                {/* 요약은 종료 시 생성되지만 full은 항상 3탭 — 종료 전엔 탭이 안내를 보인다. */}
                {view === "full" ? (
                  <TabsTrigger value="summary">요약</TabsTrigger>
                ) : null}
                <TabsTrigger value="details">노트 정보</TabsTrigger>
              </TabsList>
            </div>
          </div>
          <TabsContent value="transcript" className="min-h-0 flex-1">
            {/* 종료된 회의는 전사 탭이 아카이브(전사 + 공유 Q&A)가 된다. */}
            {showArchive ? (
              <NoteArchive noteId={noteId} />
            ) : (
              <TranscriptView noteId={noteId} />
            )}
          </TabsContent>
          <TabsContent value="summary" className="min-h-0 flex-1">
            <ScrollArea className="h-full">
              <NoteSummary noteId={noteId} isEnded={phase === "ended"} />
            </ScrollArea>
          </TabsContent>
          <TabsContent value="details" className="min-h-0 flex-1">
            <ScrollArea className="h-full">
              <DataBoundary
                fallback={<NoteDetailsSkeleton />}
                errorLabel="노트를 불러오지 못했습니다"
                resetKeys={[noteId]}
              >
                <NoteDetails noteId={noteId} />
              </DataBoundary>
            </ScrollArea>
          </TabsContent>
        </Tabs>

        {showDock ? (
          /* 개인 챗봇 FAB이 `fixed right-6 bottom-6 size-12`로 같은 띠에 있다. 좁은 화면에서는
            독이 그 아래로 들어가 가려지므로 레인에서 FAB 자리를 뺀다(24 + 48 + 여백).
            sm부터는 가운데 정렬로 돌아가도 닿지 않는다. */
          <div className="pointer-events-none absolute inset-x-0 bottom-6 z-30 flex justify-center pl-5 pr-[84px] sm:px-9">
            <div className="pointer-events-auto min-w-0">
              {/* 독을 숨기지 않는 이유는 왜 못 하는지가 화면에 남아야 하기 때문이다 —
                시작 버튼 자리에 이 문구가 선다. */}
              <RecordingDock
                noteId={noteId}
                disabledReason={startBlockedReason}
              />
            </div>
          </div>
        ) : null}
      </div>

      {showSharedTray ? (
        // 넓은 화면은 우측 대화 트레이(464 — FORM SPEC 레이아웃 산술), 좁은 화면은 본문 아래
        // 스택 — 어느 폭에서도 공유 챗봇에 닿는다. 회의 중에는 개인 챗봇도 감춰지므로 여기가
        // 유일한 챗 입구다.
        <div className="flex h-[45vh] w-full shrink-0 border-t border-[var(--el-hairline)] lg:h-full lg:w-[464px] lg:border-t-0">
          <SharedChatPanel
            noteId={noteId}
            phase={phase}
            onTurnActiveChange={setSharedTurnActive}
          />
        </div>
      ) : null}
    </div>
  );
}
