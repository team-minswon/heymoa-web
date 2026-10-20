import type {
  ProposalRevision,
  TranscriptResponseDataSegmentsItem,
} from "@/lib/api/generated/models";

type Role = ProposalRevision["citations"][number]["role"];

/** 인용된 줄이 그 항목에 한 역할. 뒷받침하는 줄은 표시하지 않는다 — 대부분이 그렇다. */
export const CITATION_ROLE_LABEL: Partial<Record<Role, string>> = {
  REFUTES: "반대 의견",
  CONDITIONS: "조건",
  RETRACTS: "취소",
  REFERENCES: "언급",
};

export type TrailLine = {
  segmentId: string;
  startedAtMs: number;
  text: string;
  speakerLabel: string | null;
  assignedParticipantId: string | null;
  /** 인용된 줄이면 그 역할. 앞뒤 맥락 줄은 `null` */
  role: Role | null;
};

export type TrailStep = {
  key: string;
  revision: number | null;
  content: string;
  /** 스크립트가 없는 단계(검토에서 수정)는 `null` */
  startedAtMs: number | null;
  lines: TrailLine[];
};

/**
 * 수정 기록 → 스크립트. **최근 단계가 위다.** 단계마다 인용된 줄과 그 앞뒤 한 줄씩을 붙인다 —
 * 인용 한 줄만으로는 무엇에 대한 말인지 안 읽힌다.
 *
 * 사람이 검토에서 내용을 고쳤으면 맨 위에 「검토에서 수정」이 선다. 누가 언제 고쳤는지는
 * 서버가 남기지 않아, 원래 내용과 지금 내용만 보인다.
 */
export function trailOf({
  revisions,
  segments,
  currentContent,
  edited,
  context = 1,
}: {
  revisions: readonly ProposalRevision[];
  segments: readonly TranscriptResponseDataSegmentsItem[];
  currentContent: string;
  edited: boolean;
  context?: number;
}): TrailStep[] {
  const position = new Map(
    segments.map((row, index) => [row.segmentId, index])
  );
  const ordered = [...revisions].sort((a, b) => a.revision - b.revision);
  const steps = ordered.map((revision): TrailStep => {
    const roles = new Map(
      revision.citations.map((row) => [row.segmentId, row.role])
    );
    const indexes = new Set<number>();
    for (const citation of revision.citations) {
      const at = position.get(citation.segmentId);
      if (at === undefined) continue;
      for (let near = at - context; near <= at + context; near += 1) {
        if (near >= 0 && near < segments.length) indexes.add(near);
      }
    }
    const lines = [...indexes]
      .sort((a, b) => a - b)
      .map((at) => {
        const row = segments[at];
        return {
          segmentId: row.segmentId,
          startedAtMs: row.startedAtMs,
          text: row.text,
          speakerLabel: row.speakerLabel,
          assignedParticipantId: row.assignedParticipantId,
          role: roles.get(row.segmentId) ?? null,
        };
      });
    return {
      key: `r${revision.revision}`,
      revision: revision.revision,
      content: revision.content,
      startedAtMs: revision.citations[0]?.startedAtMs ?? null,
      lines,
    };
  });

  const last = ordered[ordered.length - 1];
  if (edited && (!last || last.content !== currentContent)) {
    steps.push({
      key: "review-edit",
      revision: null,
      content: last ? `${last.content} → ${currentContent}` : currentContent,
      startedAtMs: null,
      lines: [],
    });
  }
  return steps.reverse();
}
