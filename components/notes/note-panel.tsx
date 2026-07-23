"use client";

import { useState } from "react";
import { Expand, PanelRightClose } from "lucide-react";

import { MeetingControls } from "@/components/notes/meeting-controls";
import { NoteArchive } from "@/components/notes/note-archive";
import { NoteDetails } from "@/components/notes/note-details";
import { NoteSummary } from "@/components/notes/note-summary";
import { SharedChatPanel } from "@/components/notes/shared-chat-panel";
import { TranscriptView } from "@/components/notes/transcript-view";
import { RecordingDock } from "@/components/transcription/recording-dock";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useGetNote } from "@/lib/api/generated/notes/notes";
import { useGetProject } from "@/lib/api/generated/projects/projects";
import {
  deriveMeetingPhase,
  meetingRefetchInterval,
} from "@/lib/notes/meeting-state";

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
  const meetingLive =
    phase === "active" || phase === "not-started" || phase === "paused";
  const showSharedTray = view === "full" && (meetingLive || sharedTurnActive);
  // 종료 아카이브는 흐르던 공유 턴이 끝난 뒤에만 보인다(그 전엔 아직 트레이가 답변을 그린다).
  const showArchive = phase === "ended" && !sharedTurnActive;

  return (
    <div className="flex h-full min-h-0 flex-col bg-white lg:flex-row">
      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-white">
      <header className="relative z-10 border-b border-[var(--el-hairline)] bg-white/92 px-5 py-4 backdrop-blur-xl sm:px-9 sm:py-5">
        <div className="mx-auto flex w-full max-w-[820px] items-start gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              {project ? (
                <Badge variant="secondary">{project.name}</Badge>
              ) : null}
            </div>
            <h1 className="mt-2 truncate font-serif text-[28px] font-light leading-tight tracking-[-0.03em] text-[var(--el-ink)] sm:text-[32px]">
              {note?.title ?? "회의 노트"}
            </h1>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {/* 회의 조작은 full 모드 앱바에서만 — side는 컴팩트하게 둔다. */}
            {view === "full" && note ? (
              <MeetingControls
                note={note}
                onMeetingEnded={() => onTabChange("summary")}
              />
            ) : null}
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
            <NoteDetails noteId={noteId} />
          </ScrollArea>
        </TabsContent>
      </Tabs>

        <div className="pointer-events-none absolute inset-x-0 bottom-6 z-30 flex justify-center px-5 sm:px-9">
          <div className="pointer-events-auto">
            <RecordingDock noteId={noteId} />
          </div>
        </div>
      </div>

      {showSharedTray ? (
        // 넓은 화면은 우측 사이드 레일(420), 좁은 화면은 본문 아래 스택 — 어느 폭에서도
        // 공유 챗봇에 닿는다. 회의 중에는 개인 챗봇도 감춰지므로 여기가 유일한 챗 입구다.
        <div className="flex h-[45vh] w-full shrink-0 border-t border-[var(--el-hairline)] lg:h-full lg:w-[420px] lg:border-t-0">
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
