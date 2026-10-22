import type { QueryClient } from "@tanstack/react-query";

import { getGetNoteAgendasQueryOptions } from "@/lib/api/generated/notes/notes";
import { getGetProposalsQueryOptions } from "@/lib/api/generated/proposals/proposals";
import { getGetNoteTranscriptQueryOptions } from "@/lib/api/generated/transcription/transcription";
import { okData } from "@/lib/api/ok-data";
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

/**
 * 회의록 · 전체 복사가 누를 때 읽는 재료. **구독하지 않고 캐시에서 꺼낸다** — 타임라인 · 스크립트 탭이 이미 같은
 * 쿼리를 구독하고 있어, 요약 화면이 또 구독하면 같은 쿼리에 구독자만 는다(rule `architecture`). 캐시에 있으면
 * 그대로 쓰고, 없거나 오래됐으면 한 번 받는다. 끝난 회의라 그 사이 바뀔 것이 거의 없다.
 */
const FRESH_MS = 60_000;

/** 타임라인 탭과 같은 묶음 — 끝난 회의의 원장을 안건 정본대로 한 번 맞춘 것이다 */
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
  /** 화자 분리 전이면 null — 「화자 A」는 아직 아무도 아니라 이름 칸을 비운다 */
  speakerOf: SpeakerOf | null;
  truncated: boolean;
};

export async function loadTranscript(
  queryClient: QueryClient,
  noteId: string,
  participants: SpeakerFace[]
): Promise<TranscriptSource> {
  const transcript = okData(
    await queryClient.fetchQuery({
      ...getGetNoteTranscriptQueryOptions(noteId),
      staleTime: FRESH_MS,
    })
  );
  if (!transcript) throw new Error("전사를 불러오지 못했습니다");
  const diarized = transcript.diarization.status === "MAPPED";
  return {
    rows: interleaveTranscript(
      transcript.segments,
      toGapRows(transcript.gaps, transcript.transcriptGaps)
    ),
    speakerOf: diarized
      ? createSpeakerIdentityResolver(
          transcript.diarization.speakers,
          participants
        )
      : null,
    truncated: transcript.recording.seal === "TRUNCATED",
  };
}
