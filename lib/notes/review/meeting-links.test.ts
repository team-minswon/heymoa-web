import { describe, expect, it } from "vitest";

import type { ProjectMeetingLinksResponseData } from "@/lib/api/generated/models";
import { indexMeetingLinks } from "@/lib/notes/review/meeting-links";

const ref = (proposalId: string) => ({ proposalId, revision: 1 });
const link = (
  kind: string,
  from: string,
  to: string,
  content = `${to} 내용`,
  noteId = "now",
  toNote = "past"
) => ({
  kind,
  reason: "",
  evidenceSequences: [],
  source: {
    noteId,
    proposalId: from,
    revision: 1,
    proposalKind: "DECISION" as const,
    content: `${from} 내용`,
  },
  target: {
    noteId: toNote,
    proposalId: to,
    revision: 1,
    proposalKind: "DECISION" as const,
    content,
  },
});

const data: ProjectMeetingLinksResponseData = {
  notes: [
    {
      noteId: "now",
      title: "이번 회의",
      startedAt: "2026-09-11T01:45:00Z",
      agendas: [],
    },
    {
      noteId: "past",
      title: "로드맵 브레인스토밍",
      startedAt: "2026-09-04T01:00:00Z",
      agendas: [],
    },
  ],
  conflicts: [],
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
    {
      ...link("RESOLVES", "p2", "q1", "지난 질문"),
      target: {
        noteId: "past",
        proposalId: "q1",
        revision: 1,
        proposalKind: "QUESTION" as const,
        content: "지난 질문",
      },
    },
  ],
  agendaLinks: [
    {
      source: { noteId: "now", agendaId: "ag1" },
      target: { noteId: "past", agendaId: "old-ag" },
    },
    {
      source: { noteId: "now", agendaId: "ag1" },
      target: { noteId: "past", agendaId: "old-ag2" },
    },
    {
      source: { noteId: "later", agendaId: "z" },
      target: { noteId: "now", agendaId: "ag1" },
    },
  ],
};

const items = [
  {
    itemId: "i1",
    originalProposalRef: ref("p1"),
    replacements: [],
    taskChanges: [],
  },
  {
    itemId: "i2",
    originalProposalRef: ref("p2"),
    replacements: [],
    taskChanges: [],
  },
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

  it("이 회의에서 나가는 알려진 관계를 판정 종류 그대로 보존한다", () => {
    expect(index.relations.map((row) => row.kind)).toEqual([
      "SUPERSEDES",
      "COMPLETES",
      "SUPERSEDES",
      "RESOLVES",
    ]);
    expect(index.relations[0]).toMatchObject({
      sourceItemId: "i1",
      scope: "past",
      targetTitle: "로드맵 브레인스토밍",
    });
  });

  it("제안 카드와 별도로 관계 근거를 읽을 수 있고 대상 상태는 수정하지 않는다", () => {
    const before = structuredClone(items);
    expect(
      index.relations.find((row) => row.sourceItemId === "i3")?.target
        .proposalId
    ).toBe("carded");
    expect(items).toEqual(before);
  });

  it("같은 이전 회의라도 안건이 다르면 연결을 각각 보존한다", () => {
    expect(
      index.byAgendaId.get("ag1")?.map((row) => [row.noteId, row.agendaId])
    ).toEqual([
      ["past", "old-ag"],
      ["past", "old-ag2"],
    ]);
    expect(index.byAgendaId.size).toBe(1);
  });

  it("같은 회의 안건 연결과 이전 회의 사슬을 유지하고 같은 쌍은 한 번만 둔다", () => {
    const edge = {
      source: { noteId: "now", agendaId: "ag2" },
      target: { noteId: "now", agendaId: "ag1" },
    };
    const result = indexMeetingLinks(
      { ...data, agendaLinks: [...data.agendaLinks, edge, edge] },
      "now",
      items
    );
    expect(result.byAgendaId.get("ag2")).toMatchObject([
      { noteId: "now", agendaId: "ag1" },
    ]);
    expect(result.byAgendaId.get("ag1")).toHaveLength(2);
  });

  it("충돌 네 종류와 약한 이어짐, 같은 회의·승격 대상을 구별한다", () => {
    const conflicts = (
      ["CONFLICTS_WITH", "SUPERSEDES", "CANCELS", "RESOLVES"] as const
    ).map((kind) => ({
      ...link(kind, "p1", "p2", "앞 항목", "now", "now"),
      kind,
      reason: "원문 근거",
      evidenceSequences: [3],
    }));
    const approved = {
      ...link("SUCCEEDS", "p2", ""),
      target: {
        type: "APPROVED" as const,
        itemId: "approved-task",
        revision: 4,
        proposalKind: "ACTION_ITEM" as const,
        content: "기존 업무",
      },
    };
    const result = indexMeetingLinks(
      { ...data, conflicts, meetingLinks: [approved] },
      "now",
      items
    );
    expect(result.relations.map((row) => row.kind)).toEqual([
      "CONFLICTS_WITH",
      "SUPERSEDES",
      "CANCELS",
      "RESOLVES",
      "SUCCEEDS",
    ]);
    expect(result.relations[0]).toMatchObject({
      scope: "same",
      sourceItemId: "i1",
      targetItemId: "i2",
      reason: "원문 근거",
      evidenceSequences: [3],
    });
    expect(result.relations[4]).toMatchObject({
      scope: "approved",
      target: { itemId: "approved-task", revision: 4 },
    });
  });

  it("두 목록에 같은 관계가 있어도 한 번만, ID·판이 다르면 내용이 같아도 보존한다", () => {
    const edge = {
      ...link("CANCELS", "p1", "p2", "같은 문장", "now", "now"),
      kind: "CANCELS" as const,
    };
    const result = indexMeetingLinks(
      {
        ...data,
        conflicts: [edge],
        meetingLinks: [
          edge,
          { ...edge, target: { ...edge.target, revision: 2 } },
          { ...edge, target: { ...edge.target, proposalId: "p3" } },
        ],
      },
      "now",
      items
    );
    expect(result.relations).toHaveLength(3);
    expect(result.relations.map((row) => row.targetItemId)).toEqual([
      "i2",
      null,
      "i3",
    ]);
  });

  it("옛 응답의 conflicts 누락과 연결 미조회도 처리한다", () => {
    const { conflicts: omitted, ...legacy } = data;
    expect(omitted).toEqual([]);
    expect(
      indexMeetingLinks(legacy as ProjectMeetingLinksResponseData, "now", items)
        .relations
    ).toHaveLength(4);
    expect(indexMeetingLinks(undefined, "now", items).relations).toEqual([]);
  });
});
