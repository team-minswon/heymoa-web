"use client";

import Link from "next/link";
import { Square } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { usePathname } from "next/navigation";

import { Button } from "@/components/ui/button";
import { RecordingPendingSpinner } from "@/components/transcription/recording-pending-spinner";
import {
  useRecording,
  useRecordingMeter,
  type RecordingPhase,
} from "@/components/transcription/recording-provider";
import { isWorkspaceRoute } from "@/lib/routes/app-route";

const VISIBLE_PHASES = new Set([
  "requesting-permission",
  "connecting",
  "recording",
  "stopping",
]);

export const GLOBAL_RECORDING_EXIT_DURATION = 0.3;

function formatElapsed(elapsedMs: number) {
  const totalSeconds = Math.floor(elapsedMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function GlobalRecordingPill({
  href,
  elapsedMs,
  phase,
  onStop,
}: {
  href: string;
  elapsedMs: number;
  phase: RecordingPhase;
  onStop: () => void;
}) {
  const { level, levelHistory } = useRecordingMeter();
  const isRecording = phase === "recording";

  return (
    <motion.aside
      aria-label="진행 중인 녹음"
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0, transition: { duration: 0.15 } }}
      exit={{
        opacity: 0,
        y: -8,
        transition: { duration: GLOBAL_RECORDING_EXIT_DURATION },
      }}
      className="fixed right-5 top-20 z-50 flex items-center gap-2 rounded-full border border-[var(--el-hairline)] bg-[color-mix(in_srgb,white_96%,transparent)] p-1.5 pl-2.5 text-[var(--el-ink)] shadow-e2 backdrop-blur-xl"
    >
      <Link
        href={href}
        className="group flex min-w-0 items-center gap-2 rounded-full px-1.5 py-1 outline-none focus-visible:ring-2 focus-visible:ring-[var(--el-ink)]"
      >
        {isRecording ? (
          <span
            role="meter"
            aria-label="마이크 입력"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(level * 100)}
            className="flex h-5 w-8 items-center justify-center gap-[3px] rounded-full bg-[var(--el-ink)]"
          >
            {levelHistory.slice(-4).map((sample, index) => (
              <span
                key={index}
                data-testid={`global-wave-bar-${index}`}
                className="h-2.5 w-[2px] origin-center rounded-full bg-white transition-transform duration-75"
                style={{ transform: `scaleY(${Math.max(0.12, sample)})` }}
              />
            ))}
          </span>
        ) : (
          <RecordingPendingSpinner />
        )}
        <span className="font-mono text-xs tabular-nums">
          {formatElapsed(elapsedMs)}
        </span>
      </Link>
      <div className="h-5 w-px bg-[var(--el-hairline)]" />
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label="녹음 종료"
        onClick={onStop}
        disabled={phase !== "recording"}
        className="size-7 rounded-full text-destructive hover:bg-destructive/8 hover:text-destructive"
      >
        <Square className="size-3.5" />
      </Button>
    </motion.aside>
  );
}

export function GlobalRecordingIndicator() {
  const pathname = usePathname();
  const { session, activeWorkspaceId, elapsedMs, phase, stop } = useRecording();
  const isVisible =
    !isWorkspaceRoute(pathname) &&
    Boolean(session) &&
    VISIBLE_PHASES.has(phase);
  /**
   * **녹음 중인 워크스페이스로 돌아간다.** 예전에는 기본 워크스페이스(`find(isDefault) ?? [0]`)를
   * 골랐는데, 그것은 지금 녹음 중인 곳이 아닐 수 있다 — 기본이 아닌 A를 녹음하다 홈에 오면
   * `/w/B/notes/<A의 노트>`가 만들어졌다. 노트 조회는 워크스페이스를 받지 않아 A의 노트가
   * 그대로 그려지므로 **틀린 URL인 줄도 모른 채** 그 화면에서 재개하게 되고, 그러면 녹음의
   * 소속이 B로 기록돼 A의 나가기 잠금과 추방 정리가 둘 다 빗나간다.
   *
   * 이제 `start()`가 소속을 들고 있으니 목록을 뒤질 필요가 없다.
   */
  const href = activeWorkspaceId
    ? `/w/${activeWorkspaceId}/notes/${session?.noteId ?? ""}?view=full&tab=transcript`
    : "#";

  return (
    <AnimatePresence>
      {isVisible ? (
        <GlobalRecordingPill
          href={href}
          elapsedMs={elapsedMs}
          phase={phase}
          onStop={() => void stop()}
        />
      ) : null}
    </AnimatePresence>
  );
}
