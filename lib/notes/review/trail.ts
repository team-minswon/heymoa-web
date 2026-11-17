import type {
  ProposalRevision,
  TranscriptResponseDataSegmentsItem,
} from "@/lib/api/generated/models";

type Role = ProposalRevision["citations"][number]["role"];

export const LABELED_CITATION_ROLES = [
  "REFUTES",
  "CONDITIONS",
  "RETRACTS",
  "REFERENCES",
] as const satisfies readonly Role[];
export type LabeledCitationRole = (typeof LABELED_CITATION_ROLES)[number];
export const isLabeledRole = (role: Role): role is LabeledCitationRole =>
  (LABELED_CITATION_ROLES as readonly Role[]).includes(role);

export type TrailLine = {
  segmentId: string;
  startedAtMs: number;
  text: string;
  speakerLabel: string | null;
  assignedParticipantId: string | null;
  role: Role | null;
};

export type TrailStep = {
  key: string;
  revision: number | null;
  content: string;
  startedAtMs: number | null;
  lines: TrailLine[];
};

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
