import type { QueryClient } from "@tanstack/react-query";

import { getGetNoteAgendasQueryOptions } from "@/lib/api/generated/notes/notes";
import { getGetProposalsQueryOptions } from "@/lib/api/generated/proposals/proposals";
import { getGetNoteTranscriptQueryOptions } from "@/lib/api/generated/transcription/transcription";
import { okData } from "@/lib/api/ok-data";
import { webMessage } from "@/lib/i18n/web-message";
import {
  initialContextState,
  reduceContextEvent,
} from "@/lib/notes/proposals/reducer";
import { selectContextSnapshot } from "@/lib/notes/proposals/select";
import {
  placeAgendas,
  selectTimeline,
  type TimelineGroup,
} from "@/lib/notes/proposals/timeline";
import { toGapRows } from "@/lib/transcription/gaps";
import {
  interleaveTranscript,
  type TranscriptRow,
} from "@/lib/transcription/presentation";
import {
  createSpeakerIdentityResolver,
  type SpeakerFace,
} from "@/lib/transcription/speaker-identity";
import type { SpeakerOf } from "@/lib/notes/minutes/model";

const FRESH_MS = 60_000;

export async function loadTimelineGroups(
  queryClient: QueryClient,
  noteId: string
): Promise<TimelineGroup[]> {
  const [proposals, agendas] = await Promise.all([
    queryClient.fetchQuery({
      ...getGetProposalsQueryOptions(noteId),
      staleTime: FRESH_MS,
    }),
    queryClient.fetchQuery({
      ...getGetNoteAgendasQueryOptions(noteId),
      staleTime: FRESH_MS,
    }),
  ]);
  const snapshot = selectContextSnapshot(proposals);
  const state = reduceContextEvent(initialContextState, {
    type: "snapshot",
    ...snapshot,
  });
  const list = okData(agendas);
  const plan = list
    ? {
        list,
        placement: placeAgendas(new Map(), snapshot.proposals, list, false),
      }
    : null;
  return selectTimeline(state, "ALL", plan).groups;
}

export type TranscriptSource = {
  rows: TranscriptRow[];
  speakerOf: SpeakerOf | null;
  truncated: boolean;
};

export async function loadTranscript(
  queryClient: QueryClient,
  noteId: string,
  participants: SpeakerFace[],
  speakerName: (label: string) => string
): Promise<TranscriptSource> {
  const transcript = okData(
    await queryClient.fetchQuery({
      ...getGetNoteTranscriptQueryOptions(noteId),
      staleTime: FRESH_MS,
    })
  );
  if (!transcript) throw new Error(webMessage("transcriptLoadFailed"));
  const diarized = transcript.diarization.status === "MAPPED";
  return {
    rows: interleaveTranscript(
      transcript.segments,
      toGapRows(transcript.gaps, transcript.transcriptGaps)
    ),
    speakerOf: diarized
      ? createSpeakerIdentityResolver(
          transcript.diarization.speakers,
          participants,
          speakerName
        )
      : null,
    truncated: transcript.recording.seal === "TRUNCATED",
  };
}
