import type { QueryClient } from "@tanstack/react-query";

import type { DocLanguage } from "@/lib/i18n/translator";
import type { NoteMeta } from "@/lib/notes/copy-markdown";
import {
  buildMinutes,
  stillOpen,
  type MinutesDocument,
  type MinutesInclude,
  type MinutesTopic,
} from "@/lib/notes/minutes/model";
import {
  loadTimelineGroups,
  loadTranscript,
} from "@/lib/notes/minutes/sources";
import type { ReviewItem, ReviewSection } from "@/lib/notes/review/sections";
import type { SpeakerFace } from "@/lib/transcription/speaker-identity";

export function widerExports({
  queryClient,
  noteId,
  note,
  participants,
  sharedBy,
  confirmed,
  headline,
  lead,
  topics,
  sections,
  citedAt,
  unfiledOpen,
  unnamedSpeakers,
  doc,
}: {
  queryClient: QueryClient;
  noteId: string;
  note: NoteMeta;
  participants: SpeakerFace[];
  sharedBy: string | null;
  confirmed: boolean;
  headline: string | null;
  lead: readonly string[];
  topics: readonly MinutesTopic[];
  sections: readonly ReviewSection[];
  citedAt: (item: ReviewItem) => number | null;
  unfiledOpen: readonly ReviewItem[];
  unnamedSpeakers: number;
  doc: DocLanguage;
}) {
  const groups = () => loadTimelineGroups(queryClient, noteId);
  const transcript = () =>
    loadTranscript(queryClient, noteId, participants, (label) =>
      doc.t("notes.speakers.fallback", { label })
    );

  return {
    minutes: async (include: MinutesInclude): Promise<MinutesDocument> => {
      const [ledger, script] = await Promise.all([
        unfiledOpen.length > 0 ? groups() : Promise.resolve([]),
        include.transcript ? transcript() : Promise.resolve(null),
      ]);
      return buildMinutes({
        note,
        sharedBy,
        confirmed,
        headline,
        lead,
        topics,
        sections,
        citedAt,
        unfiledOpen: stillOpen(unfiledOpen, ledger),
        unnamedSpeakers,
        transcript: script,
        include,
        doc,
      });
    },
  };
}
