import type {
  MeetingReviewResponseDataItemsItem,
  ProjectMeetingLinksResponseData,
  ProjectMeetingLinksResponseDataMeetingLinksItem,
} from "@/lib/api/generated/models";

/**
 * 서버가 판정한 종류 중 그리는 것. 이름은 화면이 `notes.review.suggestions.relation.kinds` 에서 고른다.
 * 관계를 읽는 것으로 대상 상태나 승인을 바꾸지 않는다.
 */
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

/** 제목을 모르면 null 이다. 화면이 「이전 회의」·「안건」 같은 말을 제 언어로 채운다 */
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
    /** 이전 회의 제목. 확정 항목이거나 제목을 모르면 null */
    targetTitle: string | null;
    scope: "same" | "past" | "approved";
  };
export type MeetingLinkIndex = {
  relations: MeetingRelation[];
  byItemId: ReadonlyMap<string, MeetingRelation[]>;
  byAgendaId: ReadonlyMap<string, PastNote[]>;
};

/** 확정 항목과 원래 명제의 판은 별개이므로 각각 같은 종류의 참조끼리 비교한다. */
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

/** 내용이 같아도 ID·판이 다르면 별개 관계다. 옛 서버에는 conflicts가 없다. */
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
  // 강한 관계를 먼저 둔다. 같은 방향·끝점·종류만 중복으로 처리한다.
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
