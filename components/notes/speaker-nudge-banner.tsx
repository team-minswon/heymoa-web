"use client";

import { useTranslations } from "next-intl";

import { HelpLink } from "@/components/heymoa/help-link";
import { useGetNoteTranscript } from "@/lib/api/generated/transcription/transcription";

export function SpeakerNudgeBanner({ noteId }: { noteId: string }) {
  const t = useTranslations("notes.speakers.nudge");
  const transcriptQuery = useGetNoteTranscript(noteId);
  const transcript =
    transcriptQuery.data?.status === 200 && transcriptQuery.data.data.success
      ? transcriptQuery.data.data.data
      : null;
  const status = transcript?.diarization?.status;

  if (status === "FAILED") {
    return <Note>{t("failed")}</Note>;
  }

  if (status === "ASSEMBLING" || status === "SUBMITTED") {
    return (
      <Note testId="speaker-nudge-pending">
        {t("pending")} <HelpLink topic="speakers">{t("howTo")}</HelpLink>
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
