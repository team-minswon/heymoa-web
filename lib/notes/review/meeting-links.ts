import type {
  MeetingReviewResponseDataItemsItem,
  ProjectMeetingLinksResponseData,
  ProjectMeetingLinksResponseDataMeetingLinksItem,
} from "@/lib/api/generated/models";

export const SHOWN_LINK_KINDS = [
  "CONFLICTS_WITH",
  "SUPERSEDES",
  "CANCELS",
  "RESOLVES",
  "SUCCEEDS",
  "COMPLETES",
] as const;
export type ShownLinkKind = (typeof SHOWN_LINK_KINDS)[number];
const SHOWN: ReadonlySet<string> = new Set(SHOWN_LINK_KINDS);

export type PastNote = {
  noteId: string;
  title: string | null;
  agendaId: string;
  agendaTitle: string | null;
};
export type MeetingRelation =
  ProjectMeetingLinksResponseDataMeetingLinksItem & {
    key: string;
    sourceItemId: string | null;
    targetItemId: string | null;
    kind: ShownLinkKind;
    targetTitle: string | null;
    scope: "same" | "past" | "approved";
  };
export type MeetingLinkIndex = {
  relations: MeetingRelation[];
  byItemId: ReadonlyMap<string, MeetingRelation[]>;
  byAgendaId: ReadonlyMap<string, PastNote[]>;
};

export function relationMatchesTarget(
  relation: MeetingRelation,
  target: {
    itemId: string;
    revision: number;
    originalProposalRef: { proposalId?: string; revision: number } | null;
  }
) {
  return relation.target.type === "APPROVED"
    ? relation.target.itemId === target.itemId &&
        relation.target.revision === target.revision
    : target.originalProposalRef?.proposalId !== undefined &&
        relation.target.proposalId === target.originalProposalRef.proposalId &&
        relation.target.revision === target.originalProposalRef.revision;
}

const endpointKey = (
  end: ProjectMeetingLinksResponseDataMeetingLinksItem["target"]
) =>
  JSON.stringify([
    end.type ?? "PROPOSAL",
    end.noteId ?? null,
    end.type === "APPROVED" ? end.itemId : end.proposalId,
    end.revision,
  ]);

export function indexMeetingLinks(
  data: ProjectMeetingLinksResponseData | null | undefined,
  noteId: string,
  items: readonly Pick<
    MeetingReviewResponseDataItemsItem,
    "itemId" | "originalProposalRef"
  >[]
): MeetingLinkIndex {
  if (!data)
    return { relations: [], byItemId: new Map(), byAgendaId: new Map() };
  const notes = new Map(data.notes.map((note) => [note.noteId, note]));
  const itemOfProposal = new Map(
    items.flatMap((item) =>
      item.originalProposalRef
        ? [
            [
              JSON.stringify([
                item.originalProposalRef.proposalId,
                item.originalProposalRef.revision,
              ]),
              item.itemId,
            ] as const,
          ]
        : []
    )
  );
  const itemIdOf = (
    end: ProjectMeetingLinksResponseDataMeetingLinksItem["target"]
  ) =>
    end.type !== "APPROVED" && end.noteId === noteId && end.proposalId
      ? (itemOfProposal.get(JSON.stringify([end.proposalId, end.revision])) ??
        null)
      : null;
  const seen = new Set<string>();
  const relations: MeetingRelation[] = [];
  for (const link of [...(data.conflicts ?? []), ...data.meetingLinks]) {
    if (link.source.noteId !== noteId || !SHOWN.has(link.kind)) continue;
    const key = JSON.stringify([
      endpointKey(link.source),
      endpointKey(link.target),
      link.kind,
    ]);
    if (seen.has(key)) continue;
    seen.add(key);
    relations.push({
      ...link,
      key,
      sourceItemId: itemIdOf(link.source),
      targetItemId: itemIdOf(link.target),
      kind: link.kind as ShownLinkKind,
      targetTitle: link.target.noteId
        ? (notes.get(link.target.noteId)?.title ?? null)
        : null,
      scope:
        link.target.type === "APPROVED"
          ? "approved"
          : link.target.noteId === noteId
            ? "same"
            : "past",
    });
  }

  const byAgendaId = new Map<string, PastNote[]>();
  for (const { source, target } of data.agendaLinks) {
    if (!source || !target || source.noteId !== noteId) continue;
    if (target.noteId === noteId && target.agendaId === source.agendaId)
      continue;
    const list = byAgendaId.get(source.agendaId) ?? [];
    if (
      list.some(
        (row) =>
          row.noteId === target.noteId && row.agendaId === target.agendaId
      )
    )
      continue;
    const targetNote = notes.get(target.noteId);
    list.push({
      noteId: target.noteId,
      title: targetNote?.title ?? null,
      agendaId: target.agendaId,
      agendaTitle:
        targetNote?.agendas.find((row) => row.agendaId === target.agendaId)
          ?.title ?? null,
    });
    byAgendaId.set(source.agendaId, list);
  }
  const byItemId = new Map<string, MeetingRelation[]>();
  for (const relation of relations) {
    if (!relation.sourceItemId) continue;
    const list = byItemId.get(relation.sourceItemId) ?? [];
    list.push(relation);
    byItemId.set(relation.sourceItemId, list);
  }
  return { relations, byItemId, byAgendaId };
}
