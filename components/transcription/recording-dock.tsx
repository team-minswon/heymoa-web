"use client";

import { AnimatePresence, motion } from "motion/react";
import { Mic, RotateCcw, Square, X } from "lucide-react";

import {
  isNoteRecordingActive,
  useRecording,
  useRecordingMeter,
} from "@/components/transcription/recording-provider";
import { RecordingPendingSpinner } from "@/components/transcription/recording-pending-spinner";
import { Button } from "@/components/ui/button";

const LAYOUT_TRANSITION = {
  type: "spring" as const,
  bounce: 0,
  duration: 0.2,
};

function formatElapsed(elapsedMs: number) {
  const totalSeconds = Math.floor(elapsedMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function RecordingDock({
  noteId,
  workspaceId,
  disabledReason = null,
  startLabel = "회의 시작",
}: {
  noteId: string;
  /**
   * 이 노트가 속한 워크스페이스. 녹음은 route를 넘어 살아 있는데 계약이 노트 → 워크스페이스를
   * 안 알려줘서(노트 응답에 `projectId`만 있다) **시작하는 자리가 알려줘야 한다.**
   *
   * **확인되기 전에는 비어 있다.** URL의 값을 그냥 믿으면 `/w/B/notes/<A의 노트>` 같은
   * 딥링크에서 소속이 B로 잘못 기록된다 — 세션은 A에 생기는데 나가기 잠금과 추방 정리는
   * B를 본다. 그래서 노트가 속한 프로젝트로 확인될 때까지 시작을 열지 않는다.
   */
  workspaceId: string | undefined;
  /**
   * 녹음을 시작할 수 없는 지속 상태의 이유(예: 종료된 회의). 있으면 시작 컨트롤 자리에
   * 이 문구가 대신 선다 — 눌러서 실패하게 두면 "지금 할 수 없음"이 오류로 읽힌다.
   */
  disabledReason?: string | null;
  startLabel?: "회의 시작" | "재개";
}) {
  const recording = useRecording();
  const meter = useRecordingMeter();
  const hasActiveSession = recording.activeNoteId
    ? isNoteRecordingActive(recording, recording.activeNoteId)
    : false;
  const isThisNote = recording.activeNoteId === noteId;
  const isOtherNote = hasActiveSession && !isThisNote;
  const state = isThisNote ? recording.phase : "idle";

  return (
    <motion.div
      layout
      aria-label="녹음 제어"
      role="group"
      // 높이를 44px로 **고정**한다. 예전에는 `min-h-11`(44px)로 의도해 놓고 안쪽 컨트롤이
      // `size-11`(44px)이라 padding까지 더해 54px로 밀려 있었고, 준비 중(h-8 스피너)만 44px로
      // 눌려 **누르는 순간 독이 줄었다 늘어났다.** 내용을 전부 `size-9`(36px)로 맞추고
      // 껍데기에 고정 높이를 박아 어느 분기에서도 키가 못 달라지게 한다.
      className="flex h-11 min-w-0 max-w-full items-center overflow-hidden rounded-full border border-[var(--el-hairline)] bg-[color-mix(in_srgb,white_96%,transparent)] p-1 text-[var(--el-ink)] shadow-e2 backdrop-blur-xl"
      style={{ borderRadius: 9999 }}
      transition={LAYOUT_TRANSITION}
    >
      <motion.div
        layout
        aria-hidden
        className="flex items-center"
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
            layout
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
              aria-label="마이크 입력"
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
            <Button
              type="button"
              variant="ghost"
              size="icon-lg"
              // 시작 전 원형 버튼과 같은 지름이어야 시작 전후로 독이 안 흔들린다.
              // `after:-inset-1`은 **보이는 크기는 36px로 두고 누르는 영역만 44px**로 넓힌다 —
              // 독을 44px로 줄이면서 탭 영역까지 같이 줄면 모바일에서 가장자리가 안 먹는다.
              className="size-9 shrink-0 rounded-full text-[var(--el-muted-soft)] hover:bg-[var(--el-surface-strong)] hover:text-[var(--el-muted)] after:absolute after:-inset-1 after:content-['']"
              aria-label="중지"
              onClick={() => void recording.stop()}
            >
              <Square className="size-3.5" />
            </Button>
          </motion.div>
        ) : state === "requesting-permission" ||
          state === "connecting" ||
          state === "stopping" ? (
          <motion.div
            layout
            key="pending"
            initial={{ opacity: 0 }}
            animate={{
              opacity: 1,
              transition: { duration: 0.15, delay: 0.1 },
            }}
            exit={{ opacity: 0, transition: { duration: 0.08 } }}
            className="flex h-9 shrink-0 items-center px-1"
          >
            <RecordingPendingSpinner />
          </motion.div>
        ) : disabledReason ? (
          // 녹음 중·정리 중은 위에서 먼저 걸린다 — 다른 멤버가 회의를 끝내도 내 정지 버튼은
          // 남는다. 여기 오는 것은 시작할 수 있었을 자리뿐이고, 그 자리에 이유를 대신 놓는다.
          // 잠긴 버튼 + title은 터치에서 호버가 없고 disabled는 포커스도 안 받아 이유가 사라진다.
          // failed보다도 먼저 선다 — 세션이 열린 실패는 note-panel이 원격 기록으로 취급한다
          // (APP-288). 그래서 회의 중 실패의 사유는 세션이 닫힌 뒤에야 이 아래 분기로 보인다.
          <motion.div
            layout
            key="blocked"
            initial={{ opacity: 0 }}
            animate={{
              opacity: 1,
              transition: { duration: 0.15, delay: 0.1 },
            }}
            exit={{ opacity: 0, transition: { duration: 0.08 } }}
            className="flex h-9 min-w-0 items-center px-2.5"
          >
            {/* 이유는 문장이라 좁은 화면에서 잘리면 안 된다 — 다른 분기와 달리 접힌다. */}
            <span className="text-xs leading-snug text-[var(--el-muted)]">
              {disabledReason}
            </span>
          </motion.div>
        ) : state === "failed" ? (
          // 사유 문구는 여기 두지 않는다. `RecordingErrorToast`(app/providers.tsx)가 같은
          // `recording.error`를 이미 토스트로 띄우고 있어서 **같은 문장이 두 곳에 났고**,
          // 마이크 권한 안내처럼 긴 문장이 들어오면 독이 화면 폭만큼 늘어났다.
          // 여기 남기는 것은 되돌릴 수단(다시 시도·닫기)뿐이다.
          <motion.div
            layout
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
              onClick={() =>
                workspaceId && void recording.start(noteId, workspaceId)
              }
            >
              <RotateCcw className="size-3.5" />
              다시 시도
            </Button>
            {/* 서버 세션이 열려 있으면(READY/ACTIVE) 닫기를 숨긴다 — disconnect()는 로컬만
                지우므로 서버에 열린 세션이 남아 회의 종료·재시작이 계속 거절된다. */}
            {!isNoteRecordingActive(recording, noteId) ? (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="닫기"
                className="size-9 shrink-0 rounded-full text-[var(--el-muted-soft)] hover:text-[var(--el-muted)] after:absolute after:-inset-1 after:content-['']"
                onClick={() => void recording.disconnect()}
              >
                <X className="size-3.5" />
              </Button>
            ) : null}
          </motion.div>
        ) : (
          <motion.div
            layout
            key="idle"
            initial={{ opacity: 0 }}
            animate={{
              opacity: 1,
              transition: { duration: 0.15, delay: 0.1 },
            }}
            exit={{ opacity: 0, transition: { duration: 0.08 } }}
            className="flex shrink-0 items-center px-1"
          >
            <button
              type="button"
              className="relative flex size-9 items-center justify-center rounded-full bg-destructive shadow-sm transition-colors hover:bg-destructive/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive/50 disabled:cursor-not-allowed disabled:opacity-45 after:absolute after:-inset-1 after:content-['']"
              aria-label={isOtherNote ? "다른 노트에서 녹음 중" : startLabel}
              // 소속이 확인되기 전에는 못 누른다 — 확인 없이 시작하면 잘못된 워크스페이스로
              // 기록된다. 조회는 곧 끝나고, 어긋난 URL이면 위 `disabledReason`이 이유를 세운다.
              disabled={isOtherNote || !workspaceId}
              onClick={() =>
                workspaceId && void recording.start(noteId, workspaceId)
              }
            >
              <span className="size-2.5 rounded-full bg-white" aria-hidden />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
