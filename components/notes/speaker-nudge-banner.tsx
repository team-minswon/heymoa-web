"use client";

import { useGetNoteTranscript } from "@/lib/api/generated/transcription/transcription";

/**
 * 화자 분리가 **지금 어디까지 왔나**만 말한다.
 *
 * 예전에는 여기가 「N명 확인하면 담당자가 채워집니다」와 재생성 버튼까지 들고 있었다.
 * 그런데 이 컴포넌트는 요약을 못 읽는다 — 계약에 「이 요약이 이름을 알고 만들어졌나」가
 * 없어서, 이름을 한 번 붙이면 **이미 반영된 요약 위에도 영영 떠 있었다.** 눌러도 같은
 * 요약이 다시 나온다.
 *
 * 그래서 권유를 걷어내고 재생성은 요약 탭의 **고정 버튼**으로 옮겼다. 여기 남는 것은
 * 「아직 화자를 모른다」는 사실뿐이고, 그건 실제로 여기서만 알 수 있다.
 */
export function SpeakerNudgeBanner({ noteId }: { noteId: string }) {
  // 아카이브가 이미 같은 키로 구독 중이면 TanStack Query가 왕복을 합쳐 준다.
  const transcriptQuery = useGetNoteTranscript(noteId);
  const transcript =
    transcriptQuery.data?.status === 200 && transcriptQuery.data.data.success
      ? transcriptQuery.data.data.data
      : null;
  const status = transcript?.diarization?.status;

  if (status === "FAILED") {
    return <Note>화자를 나누지 못했습니다.</Note>;
  }

  // **분리가 도는 몇 분 동안 화면이 아무 말도 안 하면** 사용자는 화자 기능이 없는 줄
  // 알고 닫는다. 그리고 그 몇 분이 **화자를 아는 사람이 아직 앉아 있는 유일한 시간**이다.
  if (status === "ASSEMBLING" || status === "SUBMITTED") {
    return (
      <Note testId="speaker-nudge-pending">
        화자를 나누는 중입니다. 끝나면 누가 누구인지 알려주실 수 있습니다.
      </Note>
    );
  }

  return null;
}

function Note({
  children,
  testId,
}: {
  children: React.ReactNode;
  testId?: string;
}) {
  return (
    <p
      data-testid={testId}
      className="rounded-block border border-[var(--el-hairline)] bg-[var(--el-canvas-soft)] px-4 py-3 text-sm text-[var(--el-muted)]"
    >
      {children}
    </p>
  );
}
