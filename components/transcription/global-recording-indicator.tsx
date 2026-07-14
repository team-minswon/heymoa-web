"use client";

import Link from "next/link";
import { Pause, Radio, Square } from "lucide-react";
import { usePathname } from "next/navigation";

import { Button } from "@/components/ui/button";
import { useGetWorkspaces } from "@/lib/api/generated/workspaces/workspaces";
import { useRecording } from "@/components/transcription/recording-provider";
import { isWorkspaceRoute } from "@/lib/routes/app-route";

const ACTIVE_STATUSES = new Set([
  "CONNECTING",
  "STREAMING",
  "PAUSED",
  "FINALIZING",
]);

function formatElapsed(elapsedMs: number) {
  const totalSeconds = Math.floor(elapsedMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function GlobalRecordingIndicator() {
  const pathname = usePathname();
  const {
    session,
    elapsedMs,
    level,
    levelHistory,
    microphoneState,
    pause,
    resume,
    stop,
  } = useRecording();
  const workspacesQuery = useGetWorkspaces({
    query: { enabled: Boolean(session), staleTime: 5 * 60 * 1000 },
  });

  if (
    isWorkspaceRoute(pathname) ||
    !session ||
    !ACTIVE_STATUSES.has(session.status)
  )
    return null;

  const workspaceEnvelope =
    workspacesQuery.data?.status === 200 ? workspacesQuery.data.data : undefined;
  const workspaces = workspaceEnvelope?.success
    ? (workspaceEnvelope.data.workspaces ?? [])
    : [];
  const workspaceId =
    workspaces.find((workspace) => workspace.isDefault)?.workspaceId ??
    workspaces[0]?.workspaceId;
  const href = workspaceId
    ? `/w/${workspaceId}/notes/${session.noteId}?view=full&tab=transcript`
    : "#";
  const paused = session.status === "PAUSED";
  const stateLabel = paused
    ? "일시정지"
    : microphoneState === "denied"
      ? "마이크 권한 필요"
      : microphoneState === "unavailable"
        ? "마이크 없음"
        : microphoneState === "recording"
          ? "녹음 중"
          : "마이크 대기 중";

  return (
    <aside
      aria-label="진행 중인 녹음"
      className="fixed right-5 top-20 z-50 flex items-center gap-2 rounded-full border border-[var(--el-hairline)] bg-[color-mix(in_srgb,white_96%,transparent)] p-1.5 pl-2.5 text-[var(--el-ink)] shadow-[0_8px_32px_rgba(28,25,23,0.12)] backdrop-blur-xl"
    >
      <Link
        href={href}
        className="group flex min-w-0 items-center gap-2 rounded-full px-1.5 py-1 outline-none focus-visible:ring-2 focus-visible:ring-[var(--el-ink)]"
      >
        <span
          role="meter"
          aria-label="마이크 입력"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(level * 100)}
          className="flex h-5 items-center gap-[3px] rounded-full bg-[var(--el-ink)] px-2"
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
        <span className="min-w-0 leading-none">
          <span className="block text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--el-muted)]">
            {stateLabel}
          </span>
          <span className="mt-1 block font-mono text-xs tabular-nums">
            {formatElapsed(elapsedMs)}
          </span>
        </span>
      </Link>
      <div className="h-5 w-px bg-[var(--el-hairline)]" />
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={paused ? "녹음 재개" : "녹음 일시 정지"}
        onClick={() => void (paused ? resume() : pause())}
        className="size-7 rounded-full text-[var(--el-muted)] hover:text-[var(--el-ink)] hover:bg-[var(--el-surface-strong)]"
      >
        {paused ? <Radio className="size-3.5" /> : <Pause className="size-3.5" />}
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label="녹음 종료"
        onClick={() => void stop()}
        className="size-7 rounded-full text-destructive hover:text-destructive hover:bg-destructive/8"
      >
        <Square className="size-3.5" />
      </Button>
    </aside>
  );
}
