import type { QueryClient } from "@tanstack/react-query";

import type { NoteMeta } from "@/lib/notes/copy-markdown";
import {
  buildMinutes,
  stillOpen,
  type MinutesDocument,
  type MinutesInclude,
  type MinutesTopic,
} from "@/lib/notes/minutes/model";
import { loadTimelineGroups, loadTranscript } from "@/lib/notes/minutes/sources";
import type { ReviewItem, ReviewSection } from "@/lib/notes/review/sections";
import type { SpeakerFace } from "@/lib/transcription/speaker-identity";

/**
 * 요약 화면이 들고 있지 않은 재료(원장 · 녹취록)까지 쓰는 회의록 PDF. 누를 때 재료를 읽는다. 복사는 탭마다 따로다 —
 * 요약은 요약 탭, 타임라인은 타임라인 탭, 녹취록은 스크립트 탭이 복사한다.
 */
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
}: {
  queryClient: QueryClient;
  noteId: string;
  /** 회의 길이(`durationMs`)까지 채운 머리말 */
  note: NoteMeta;
  participants: SpeakerFace[];
  sharedBy: string | null;
  /** 검토를 마쳐 확정했는가 */
  confirmed: boolean;
  /** 회의를 구별하는 제목 후보와 회의 정리 전문. 서로 다른 내용이므로 따로 전달한다. */
  headline: string | null;
  lead: readonly string[];
  topics: readonly MinutesTopic[];
  sections: readonly ReviewSection[];
  citedAt: (item: ReviewItem) => number | null;
  /** 어느 안건에도 들지 않은 질문 · 이슈 */
  unfiledOpen: readonly ReviewItem[];
  /** 이름이 정해지지 않은 화자 수 */
  unnamedSpeakers: number;
}) {
  const groups = () => loadTimelineGroups(queryClient, noteId);
  const transcript = () => loadTranscript(queryClient, noteId, participants);

  return {
    minutes: async (include: MinutesInclude): Promise<MinutesDocument> => {
      const [ledger, script] = await Promise.all([
        // 안건 밖 질문 · 이슈가 있을 때만 원장을 읽어 아직 열린 것을 가린다. **못 읽으면 회의록을 만들지 않는다** —
        // 미결이 빠진 문서를 온전한 것처럼 내려받게 되면 안 된다. 창의 실패 안내로 올라가 다시 받는다
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
      });
    },
  };
}
