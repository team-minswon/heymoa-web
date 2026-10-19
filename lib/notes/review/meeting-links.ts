import type {
  MeetingReviewResponseDataItemsItem,
  ProjectMeetingLinksResponseData,
  ProjectMeetingLinksResponseDataMeetingLinksItemTargetProposalKind,
} from "@/lib/api/generated/models";

/**
 * 요약 보기에 싣는 회의 간 연결. 이 회의에서 **나가는** 연결만 보인다 — 지난 회의 화면에 「이후 회의에서
 * 바뀜」을 거꾸로 보이지 않는다. 보기만 하고 지난 항목의 상태는 바꾸지 않는다(그건 제안 카드의 일이다).
 */

/** 믿을 만하고 행동을 바꾸는 관계 넷만 — 바꿈 · 취소 · 마침 · 해결 */
export const SHOWN_LINK_KINDS: ReadonlySet<string> = new Set(["SUPERSEDES", "CANCELS", "COMPLETES", "RESOLVES"]);

export type PastNote = { noteId: string; title: string };
export type PastItem = PastNote & { kind: ProjectMeetingLinksResponseDataMeetingLinksItemTargetProposalKind; content: string };

export type MeetingLinkIndex = {
  /** 검토 항목 → 이어진 지난 항목. 같은 지난 항목을 제안 카드가 다루면 빠진다 */
  byItemId: ReadonlyMap<string, PastItem[]>;
  /** 이 회의의 주제(agendaId) → 이어진 지난 회의 */
  byAgendaId: ReadonlyMap<string, PastNote[]>;
};

const EMPTY: MeetingLinkIndex = { byItemId: new Map(), byAgendaId: new Map() };

export function indexMeetingLinks(
  data: ProjectMeetingLinksResponseData | null | undefined,
  noteId: string,
  items: readonly Pick<MeetingReviewResponseDataItemsItem, "itemId" | "originalProposalRef" | "replacements" | "taskChanges">[]
): MeetingLinkIndex {
  if (!data) return EMPTY;
  const titleOf = new Map(data.notes.map((note) => [note.noteId, note.title]));
  const itemOfProposal = new Map(
    items.flatMap((item) => (item.originalProposalRef ? [[item.originalProposalRef.proposalId, item.itemId] as const] : []))
  );
  // 제안 카드가 이미 다루는 지난 명제 — 같은 것을 한 줄로 또 보이면 겹친다
  const carded = new Set(
    items.flatMap((item) => [
      ...item.replacements.flatMap((row) => (row.target.originalProposalRef ? [row.target.originalProposalRef.proposalId] : [])),
      ...item.taskChanges.flatMap((row) => (row.target.originalProposalRef ? [row.target.originalProposalRef.proposalId] : [])),
    ])
  );

  const byItemId = new Map<string, PastItem[]>();
  for (const link of [...data.meetingLinks, ...data.conflicts]) {
    if (link.source.noteId !== noteId || !SHOWN_LINK_KINDS.has(link.kind)) continue;
    // 승계 항목은 출처 회의가 삭제돼도 남습니다. 없는 출처를 회의 링크로 만들지 않습니다.
    if (link.target.noteId == null || link.target.proposalId == null) continue;
    if (carded.has(link.target.proposalId)) continue;
    const itemId = itemOfProposal.get(link.source.proposalId);
    if (!itemId) continue;
    const list = byItemId.get(itemId) ?? [];
    if (list.some((row) => row.content === link.target.content && row.noteId === link.target.noteId)) continue;
    list.push({
      noteId: link.target.noteId,
      title: titleOf.get(link.target.noteId) ?? "",
      kind: link.target.proposalKind,
      content: link.target.content,
    });
    byItemId.set(itemId, list);
  }

  const byAgendaId = new Map<string, PastNote[]>();
  for (const link of data.agendaLinks) {
    const { source, target } = link;
    if (!source || !target || source.noteId !== noteId || target.noteId === noteId) continue;
    const list = byAgendaId.get(source.agendaId) ?? [];
    if (list.some((row) => row.noteId === target.noteId)) continue;
    list.push({ noteId: target.noteId, title: titleOf.get(target.noteId) ?? "" });
    byAgendaId.set(source.agendaId, list);
  }
  return { byItemId, byAgendaId };
}
