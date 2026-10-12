import { describe, expect, it } from "vitest";

import type { ProjectMeetingLinksResponseData } from "@/lib/api/generated/models";
import { indexMeetingLinks } from "@/lib/notes/review/meeting-links";

const ref = (proposalId: string) => ({ proposalId, revision: 1 });
const link = (kind: string, from: string, to: string, content = `${to} 내용`, noteId = "now", toNote = "past") => ({
  kind,
  reason: "",
  evidenceSequences: [],
  source: { noteId, proposalId: from, revision: 1, proposalKind: "DECISION" as const, content: `${from} 내용` },
  target: { noteId: toNote, proposalId: to, revision: 1, proposalKind: "DECISION" as const, content },
});

const data: ProjectMeetingLinksResponseData = {
  notes: [
    { noteId: "now", title: "이번 회의", startedAt: "2026-09-11T01:45:00Z", agendas: [] },
    { noteId: "past", title: "로드맵 브레인스토밍", startedAt: "2026-09-04T01:00:00Z", agendas: [] },
  ],
  meetingLinks: [
    link("SUPERSEDES", "p1", "old1"),
    link("COMPLETES", "p2", "old2"),
    // 보이지 않는 관계 종류
    link("SUPPORTS", "p1", "old3"),
    // 지난 회의에서 들어오는 연결 — 이 회의에서는 보이지 않는다
    link("SUPERSEDES", "x", "p1", "이번 결정", "later", "now"),
    // 같은 지난 항목에 제안 카드가 있다
    link("SUPERSEDES", "p3", "carded"),
    // 지난 질문을 푼다 — 종류는 응답 그대로
    { ...link("RESOLVES", "p2", "q1", "지난 질문"), target: { noteId: "past", proposalId: "q1", revision: 1, proposalKind: "QUESTION" as const, content: "지난 질문" } },
  ],
  agendaLinks: [
    { source: { noteId: "now", agendaId: "ag1" }, target: { noteId: "past", agendaId: "old-ag" } },
    { source: { noteId: "now", agendaId: "ag1" }, target: { noteId: "past", agendaId: "old-ag2" } },
    { source: { noteId: "later", agendaId: "z" }, target: { noteId: "now", agendaId: "ag1" } },
  ],
};

const items = [
  { itemId: "i1", originalProposalRef: ref("p1"), replacements: [], taskChanges: [] },
  { itemId: "i2", originalProposalRef: ref("p2"), replacements: [], taskChanges: [] },
  {
    itemId: "i3",
    originalProposalRef: ref("p3"),
    replacements: [
      {
        kind: "SUPERSEDES",
        label: "대체",
        reason: "",
        decision: null,
        target: {
          itemId: "k",
          revision: 1,
          kind: "DECISION" as const,
          content: "카드가 다루는 결정",
          noteId: "past",
          noteTitle: "로드맵 브레인스토밍",
          approvedAt: "2026-09-04T01:00:00Z",
          endedAt: null,
          originalProposalRef: ref("carded"),
        },
      },
    ],
    taskChanges: [],
  },
];

describe("indexMeetingLinks", () => {
  const index = indexMeetingLinks(data, "now", items);

  it("이 회의에서 나가는 강한 관계 넷만, 검토 항목에 붙인다", () => {
    expect(index.byItemId.get("i1")).toEqual([{ noteId: "past", title: "로드맵 브레인스토밍", kind: "DECISION", content: "old1 내용" }]);
    expect(index.byItemId.get("i2")?.map((row) => [row.kind, row.content])).toEqual([
      ["DECISION", "old2 내용"],
      ["QUESTION", "지난 질문"],
    ]);
  });

  it("같은 지난 항목을 제안 카드가 다루면 연결 줄은 뺀다", () => {
    expect(index.byItemId.has("i3")).toBe(false);
  });

  it("주제 이어짐은 이 회의의 주제에서 나가는 것만, 지난 회의 하나에 한 번만", () => {
    expect(index.byAgendaId.get("ag1")).toEqual([{ noteId: "past", title: "로드맵 브레인스토밍" }]);
    expect(index.byAgendaId.size).toBe(1);
  });

  it("연결 응답이 없으면 비어 있다", () => {
    expect(indexMeetingLinks(undefined, "now", items).byItemId.size).toBe(0);
  });
});
