import type {
  MeetingReviewResponseDataItemsItem,
  ProjectMeetingLinksResponseData,
  ProjectMeetingLinksResponseDataMeetingLinksItem,
} from "@/lib/api/generated/models";

/** 서버가 판정한 종류를 그대로 표시한다. 관계를 읽는 것으로 대상 상태나 승인을 바꾸지 않는다. */
export const LINK_LABEL: Readonly<Record<string, string>> = {
  CONFLICTS_WITH: "충돌",
  SUPERSEDES: "대체",
  CANCELS: "취소",
  RESOLVES: "해결",
  SUCCEEDS: "이어짐",
  COMPLETES: "마침",
};
export const SHOWN_LINK_KINDS: ReadonlySet<string> = new Set(
  Object.keys(LINK_LABEL)
);

export type PastNote = {
  noteId: string;
  title: string;
  agendaId: string;
  agendaTitle: string;
};
export type MeetingRelation =
  ProjectMeetingLinksResponseDataMeetingLinksItem & {
    key: string;
    sourceItemId: string | null;
    targetItemId: string | null;
    targetTitle: string;
    scope: "same" | "past" | "approved";
  };
export type MeetingLinkIndex = {
  relations: MeetingRelation[];
  byAgendaId: ReadonlyMap<string, PastNote[]>;
};

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
  if (!data) return { relations: [], byAgendaId: new Map() };
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
    if (link.source.noteId !== noteId || !SHOWN_LINK_KINDS.has(link.kind))
      continue;
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
      targetTitle: link.target.noteId
        ? (notes.get(link.target.noteId)?.title ?? "이전 회의")
        : "프로젝트 확정 항목",
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
      title: targetNote?.title ?? "이전 회의",
      agendaId: target.agendaId,
      agendaTitle:
        targetNote?.agendas.find((row) => row.agendaId === target.agendaId)
          ?.title ?? "안건",
    });
    byAgendaId.set(source.agendaId, list);
  }
  return { relations, byAgendaId };
}
