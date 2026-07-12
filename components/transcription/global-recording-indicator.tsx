"use client";

import Link from "next/link";
import { Pause, Radio, Square } from "lucide-react";
import { usePathname } from "next/navigation";

import { Button } from "@/components/ui/button";
import { useListWorkspaces } from "@/lib/api/generated/workspace/workspace";
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
  const { session, elapsedMs, level, microphoneState, pause, resume, stop } =
    useRecording();
  const workspaceQuery = useListWorkspaces({
    query: { enabled: Boolean(session), staleTime: 5 * 60 * 1000 },
  });

  if (
    isWorkspaceRoute(pathname) ||
    !session ||
    !ACTIVE_STATUSES.has(session.status)
  )
    return null;

  const workspaceEnvelope =
    workspaceQuery.data?.status === 200 ? workspaceQuery.data.data : undefined;
  const workspaces = workspaceEnvelope?.success
    ? workspaceEnvelope.data.items
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
      className="fixed right-5 top-20 z-50 flex items-center gap-2 rounded-full border border-[var(--el-hairline)] bg-[color-mix(in_srgb,white_94%,transparent)] p-1.5 pl-2.5 text-[var(--el-ink)] shadow-[0_12px_40px_rgba(28,25,23,0.16)] backdrop-blur-xl"
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
          className="flex h-6 items-center gap-0.5 rounded-full bg-[var(--el-ink)] px-2 text-white"
        >
          {[0.35, 0.6, 0.85, 0.55].map((weight, index) => (
            <span
              key={index}
              className="h-3 w-0.5 origin-center rounded-full bg-white transition-transform"
              style={{ transform: `scaleY(${Math.max(0.12, level * weight)})` }}
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
      <div className="h-6 w-px bg-[var(--el-hairline)]" />
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={paused ? "녹음 재개" : "녹음 일시 정지"}
        onClick={() => void (paused ? resume() : pause())}
        className="rounded-full"
      >
        {paused ? <Radio /> : <Pause />}
      </Button>
      <Button
        type="button"
        variant="destructive"
        size="icon-sm"
        aria-label="녹음 종료"
        onClick={() => void stop()}
        className="rounded-full"
      >
        <Square />
      </Button>
    </aside>
  );
}
