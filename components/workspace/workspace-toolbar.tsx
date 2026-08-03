"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { ExternalLink, Plus, Square } from "lucide-react";

import {
  type RecordingPhase,
  useRecording,
  useRecordingMeter,
} from "@/components/transcription/recording-provider";
import { RecordingPendingSpinner } from "@/components/transcription/recording-pending-spinner";
import { NewMeetingDialog } from "@/components/workspace/new-meeting-dialog";
import { NotificationBell } from "@/components/notification/notification-bell";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { siteConfig } from "@/lib/site";
import { useCreateMeeting } from "@/lib/workspace/use-create-meeting";

function formatElapsed(elapsedMs: number) {
  const totalSeconds = Math.floor(elapsedMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function WorkspaceRecordingIndicator({
  noteId,
  phase,
  elapsedMs,
  onOpen,
  onStop,
}: {
  noteId: string;
  phase: RecordingPhase;
  elapsedMs: number;
  onOpen: (noteId: string) => void;
  onStop: () => void;
}) {
  const meter = useRecordingMeter();

  return (
    <motion.div
      initial={{ opacity: 0, y: -12, x: "-50%" }}
      animate={{ opacity: 1, y: 0, x: "-50%" }}
      exit={{ opacity: 0, y: -12, x: "-50%" }}
      className="fixed left-1/2 top-5 z-50 flex items-center gap-2 rounded-full border border-[var(--el-hairline)] bg-[color-mix(in_srgb,white_96%,transparent)] px-3 py-1.5 shadow-e2 backdrop-blur-xl"
    >
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => onOpen(noteId)}
        className="h-7 rounded-full px-2.5 text-[13px] font-medium text-[var(--el-ink)] hover:bg-[var(--el-surface-strong)]"
      >
        <ExternalLink className="size-3.5" /> 현재 녹음
      </Button>
      <div className="h-4 w-px bg-[var(--el-hairline)]" />
      {phase === "recording" ? (
        <span
          role="meter"
          aria-label="마이크 입력"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(meter.level * 100)}
          className="flex h-4 w-8 items-center justify-center gap-[3px] rounded-full bg-[var(--el-ink)]"
        >
          {meter.levelHistory.slice(-4).map((sample, index) => (
            <span
              key={index}
              className="h-2.5 w-[2px] origin-center rounded-full bg-white transition-transform duration-75"
              style={{ transform: `scaleY(${Math.max(0.12, sample)})` }}
            />
          ))}
        </span>
      ) : (
        <RecordingPendingSpinner />
      )}
      <span className="font-mono text-[13px] font-medium tabular-nums text-[var(--el-ink)]">
        {formatElapsed(elapsedMs)}
      </span>
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        className="size-7 rounded-full text-destructive"
        aria-label="녹음 종료"
        disabled={phase !== "recording"}
        onClick={onStop}
      >
        <Square className="size-3.5" />
      </Button>
    </motion.div>
  );
}

/**
 * 워크스페이스 허브의 상단바. **노트를 모른다** — 노트 전체 화면이 이 바를 통째로 덮고
 * 자기 크롬(제목·회의 제어·창 제어)을 직접 그리기 때문이다(design.pen `XtEMZ`).
 * 예전에는 여기에 노트 액션 슬롯과 노트 제목 브레드크럼이 있었고, 전체 화면이 이 바 아래에
 * 눕던 시절의 구조였다.
 */
export function WorkspaceToolbar({
  workspaceId,
  currentLabel,
  activeNoteId,
  covered = false,
}: {
  workspaceId: string;
  currentLabel: string;
  /**
   * 지금 열려 있는 노트. **크롬을 바꾸는 데는 안 쓴다** — 녹음 필을 "다른 노트에서 기록 중"
   * 일 때만 띄우기 위한 판정에만 쓴다. side 시트로 그 노트를 보고 있는데 필까지 뜨면
   * 보고 있는 회의를 "다른 곳"이라고 말하게 된다.
   */
  activeNoteId?: string;
  /**
   * 노트 전체 화면이 이 바를 덮고 있는가. **덮이는 것은 바뿐이다** — 다른 노트를 녹음 중일 때
   * 뜨는 상단 필은 `z-50`이라 그 면 위에 남아 눌려야 한다. 그래서 `inert`를 이 컴포넌트
   * 바깥에 씌우지 않고 바에만 준다(씌웠더니 필이 보이는데 안 눌렸다).
   */
  covered?: boolean;
}) {
  const router = useRouter();
  const recording = useRecording();
  const createMeeting = useCreateMeeting(workspaceId);
  const [newMeetingOpen, setNewMeetingOpen] = useState(false);
  // 노트 전체 화면이 이 바를 덮으면 **이 바가 연 창도 같이 닫는다.** 창은 포털(`z-50`)이라
  // `inert`도 덮는 면(`z-30`)도 닿지 않아서, 허브에서 열어 둔 채 뒤로가기로 노트에 오면
  // 노트 위에 남는다. 셸이 재마운트되지 않으므로 상태가 저절로 사라지지도 않는다.
  if (covered && newMeetingOpen) {
    setNewMeetingOpen(false);
  }

  const isActive = [
    "requesting-permission",
    "connecting",
    "recording",
    "stopping",
  ].includes(recording.phase);

  const openNote = (noteId: string) =>
    router.push(`/w/${workspaceId}/notes/${noteId}?view=side&tab=details`);

  const recordingNoteId = recording.activeNoteId ?? recording.session?.noteId;
  const isRecordingOtherNote =
    isActive && recordingNoteId && recordingNoteId !== activeNoteId;

  return (
    <>
      {/* 배경을 주지 않는다 — 상단바는 이제 **흰 패널 안**이라 캔버스 틴트(`--el-canvas` 88%)를
          깔면 흰 바닥 위에 회색 띠가 하나 생긴다. 각진 셸 시절엔 그 틴트가 크롬으로 읽혔지만
          패널 셸에서는 얼룩이다. 구분은 아래 hairline 하나가 한다(design.pen Top Bar). */}
      <div
        inert={covered}
        className="sticky top-0 z-20 border-b border-[var(--el-hairline)] bg-[var(--el-surface-card)]"
      >
        {/* 상단바는 56이다 — design.pen Top Bar `h-56 · px-32`. */}
        <div className="flex h-14 items-center gap-3 px-4 sm:px-6 lg:px-8">
          <SidebarTrigger className="md:hidden" />
          <nav
            aria-label="현재 위치"
            className="flex min-w-0 flex-1 items-baseline gap-2"
          >
            {/* 좁은 화면(full 노트)에서는 앞 세그먼트를 접어 노트 제목·우측 액션을 확보한다. */}
            <span className="shrink-0 font-serif text-lg font-light tracking-[-0.03em] text-[var(--el-ink)]">
              {siteConfig.name}
            </span>
            <span className="text-[var(--el-hairline-strong)]">/</span>
            <span className="shrink-0 truncate text-xs font-medium text-[var(--el-muted)]">
              {currentLabel}
            </span>
          </nav>
          <div className="flex shrink-0 items-center gap-2">
            {/* noteId로 키잉한다 — 안 하면 A의 삭제 확인창을 연 채 뒤로가기로 B에 왔을 때
                그 창이 B 제목으로 남아 엉뚱한 노트를 지운다. */}
            <Button
              type="button"
              size="sm"
              aria-label="새 노트"
              className="h-8 shrink-0 rounded-full px-3"
              disabled={createMeeting.disabled}
              loading={createMeeting.isPending}
              onClick={() => setNewMeetingOpen(true)}
            >
              <Plus className="size-3.5" />
              {/* 좁은 화면에서는 아이콘만 — 노트 액션·벨이 잘리지 않게. */}
              <span>새 노트</span>
            </Button>
            <NotificationBell />
          </div>
        </div>
      </div>

      <NewMeetingDialog
        open={newMeetingOpen}
        onOpenChange={setNewMeetingOpen}
        isPending={createMeeting.isPending}
        onSubmit={async (title) => {
          // 만들어졌을 때만 닫는다. 대상 프로젝트가 사라졌거나 응답 guard에 걸리면
          // 노트도 라우팅도 없는데 창만 닫혀 사용자가 만들어진 줄 안다.
          const created = await createMeeting.createMeeting(title);
          if (created) setNewMeetingOpen(false);
          return created;
        }}
      />

      <AnimatePresence>
        {isRecordingOtherNote ? (
          <WorkspaceRecordingIndicator
            noteId={recordingNoteId}
            phase={recording.phase}
            elapsedMs={recording.elapsedMs}
            onOpen={openNote}
            onStop={() => void recording.stop()}
          />
        ) : null}
      </AnimatePresence>
    </>
  );
}
