"use client";

import { Button } from "@/components/ui/button";
import { useGetNoteTranscript } from "@/lib/api/generated/transcription/transcription";

/**
 * 요약은 **이미 있다.** 이 배너는 무엇이 더 좋아질 수 있는지를 말한다 —
 * 「요약이 왜 없나」가 아니라 **「담당자가 왜 비었나」**에 답한다.
 *
 * 게이트가 아니다. 아무도 이름을 안 붙여도 흐름은 끝난 상태다.
 */
export function SpeakerNudgeBanner({
  noteId,
  onRegenerate,
  isRegenerating,
}: {
  noteId: string;
  onRegenerate: () => void;
  isRegenerating: boolean;
}) {
  // 아카이브가 이미 같은 키로 구독 중이면 TanStack Query가 왕복을 합쳐 준다.
  const transcriptQuery = useGetNoteTranscript(noteId);
  const transcript =
    transcriptQuery.data?.status === 200 && transcriptQuery.data.data.success
      ? transcriptQuery.data.data.data
      : null;
  const diarization = transcript?.diarization;

  if (!diarization) return null;

  if (diarization.status === "FAILED") {
    // 요약은 이미 있으므로 버튼이 없다. 할 수 있는 일이 없는데 버튼을 두면 거짓이다.
    return (
      <p className="rounded-block border border-[var(--el-hairline)] bg-[var(--el-canvas-soft)] px-4 py-3 text-sm text-[var(--el-muted)]">
        화자를 나누지 못했습니다.
      </p>
    );
  }

  if (diarization.status !== "MAPPED" || diarization.speakers.length === 0) {
    return null;
  }

  const remaining = diarization.speakers.filter(
    (speaker) => !speaker.confirmed
  ).length;

  return (
    <div
      data-testid="speaker-nudge"
      className="flex flex-wrap items-center justify-between gap-3 rounded-block border border-[var(--el-hairline)] bg-[var(--el-canvas-soft)] px-4 py-3"
    >
      <p className="text-sm text-[var(--el-ink)]">
        {remaining > 0
          ? `화자 ${remaining}명의 이름을 확인하면 담당자가 채워집니다`
          : "화자 이름을 반영해 요약을 다시 만들 수 있습니다"}
      </p>
      {remaining > 0 ? (
        // 확인은 전사 탭에서 한다 — 알아본 자리가 고치는 자리다.
        <p className="text-xs text-[var(--el-muted)]">
          대화 기록 탭에서 확인할 수 있습니다
        </p>
      ) : (
        // 자동으로 다시 만들지 않는다. 이미 읽고 일한 문서가 조용히 바뀌면 안 되고,
        // 화자를 고칠 때마다 모델을 부르게 된다. 누르는 것은 사람이다.
        <Button
          variant="outline"
          size="sm"
          className="h-[30px]"
          loading={isRegenerating}
          onClick={onRegenerate}
        >
          이름 반영해서 다시 만들기
        </Button>
      )}
    </div>
  );
}
