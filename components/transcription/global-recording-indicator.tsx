"use client";

import Link from "next/link";
import { Pause, Radio, Square, Waves } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useGetDefaultWorkspace } from "@/lib/api/generated/workspace/workspace";
import { useRecording } from "@/components/transcription/recording-provider";

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
  const { session, elapsedMs, pause, resume, stop } = useRecording();
  const workspaceQuery = useGetDefaultWorkspace({
    query: { enabled: Boolean(session), staleTime: 5 * 60 * 1000 },
  });

  if (!session || !ACTIVE_STATUSES.has(session.status)) return null;

  const workspaceEnvelope =
    workspaceQuery.data?.status === 200 ? workspaceQuery.data.data : undefined;
  const workspaceId = workspaceEnvelope?.success
    ? workspaceEnvelope.data?.workspaceId
    : undefined;
  const href = workspaceId
    ? `/w/${workspaceId}/notes/${session.noteId}?view=full&tab=transcript`
    : "#";
  const paused = session.status === "PAUSED";

  return (
    <aside
      aria-label="진행 중인 녹음"
      className="fixed right-5 top-20 z-50 flex items-center gap-2 rounded-full border border-[var(--el-hairline)] bg-[color-mix(in_srgb,white_94%,transparent)] p-1.5 pl-2.5 text-[var(--el-ink)] shadow-[0_12px_40px_rgba(28,25,23,0.16)] backdrop-blur-xl"
    >
      <Link
        href={href}
        className="group flex min-w-0 items-center gap-2 rounded-full px-1.5 py-1 outline-none focus-visible:ring-2 focus-visible:ring-[var(--el-ink)]"
      >
        <span className="relative flex size-6 items-center justify-center rounded-full bg-[var(--el-ink)] text-white">
          {paused ? <Radio className="size-3" /> : <Waves className="size-3" />}
          {!paused && (
            <span className="absolute inset-0 -z-10 animate-ping rounded-full bg-[var(--el-ink)] opacity-20" />
          )}
        </span>
        <span className="min-w-0 leading-none">
          <span className="block text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--el-muted)]">
            {paused ? "Paused" : "Recording"}
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
