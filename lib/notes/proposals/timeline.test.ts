import { describe, expect, it } from "vitest";

import {
  initialContextState,
  type ContextState,
  type ProposalHead,
} from "@/lib/notes/proposals/reducer";
import {
  placeAgendas,
  selectTimeline,
  toneOf,
} from "@/lib/notes/proposals/timeline";

let seq = 0;
function head(
  over: Partial<ProposalHead> & { atMs?: number | null }
): ProposalHead {
  seq += 1;
  const { atMs = seq * 60_000, ...rest } = over;
  const id = `0HZX2K7M9Q${String(seq).padStart(3, "0")}`;
  return {
    proposalId: id,
    revision: 1,
    operation: "CREATE",
    kind: "DECISION",
    status: "OPEN",
    closeReason: null,
    revisionSource: "LIVE",
    content: `후보 ${seq}`,
    createdSequence: seq * 10,
    lastEvidenceSequence: seq * 10,
    aiSemanticRevisionCount: 0,
    resolvesProposalId: null,
    citations:
      atMs === null
        ? []
        : [
            {
              segmentId: `0HZX2K7M9S${String(seq).padStart(3, "0")}`,
              sequence: seq * 10,
              startedAtMs: atMs,
              endedAtMs: atMs + 3_000,
              text: `발화 ${seq}`,
              role: "SUPPORTS",
            },
          ],
    ...rest,
  };
}

function stateOf(...proposals: ProposalHead[]): ContextState {
  return {
    ...initialContextState,
    proposals: Object.fromEntries(proposals.map((p) => [p.proposalId, p])),
  };
}

describe("selectTimeline", () => {
  it("안건이 나오면 그 뒤 후보를 다음 안건까지 그 아래에 묶는다", () => {
    const early = head({ kind: "INSIGHT", atMs: 60_000 });
    const a1 = head({
      kind: "AGENDA",
      content: "MongoDB 도입 검토",
      atMs: 120_000,
    });
    const d1 = head({ kind: "DECISION", atMs: 180_000 });
    const a2 = head({
      kind: "AGENDA",
      content: "다음 스프린트 범위",
      atMs: 240_000,
    });
    const t1 = head({ kind: "ACTION_ITEM", atMs: 300_000 });

    // 도착 순서와 상관없이 createdSequence 로 선다.
    const { groups } = selectTimeline(stateOf(t1, a2, d1, early, a1), "ALL");

    expect(groups.map((g) => g.agenda?.title ?? null)).toEqual([
      null,
      "MongoDB 도입 검토",
      "다음 스프린트 범위",
    ]);
    expect(
      groups.map((g) => g.items.map((i) => i.proposal.proposalId))
    ).toEqual([[early.proposalId], [d1.proposalId], [t1.proposalId]]);
    // 안건의 끝은 묶음 근거의 가장 늦은 시각이고, 마지막 안건만 열려 있다.
    expect(groups[1]).toMatchObject({
      startMs: 120_000,
      endMs: 180_000,
      last: false,
    });
    expect(groups[2]).toMatchObject({
      startMs: 240_000,
      endMs: null,
      last: true,
    });
  });

  it("근거 시각이 만든 순서와 거꾸로여도 구간은 시각의 최소·최대다", () => {
    const a1 = head({ kind: "AGENDA", content: "배포", atMs: 3_325_000 });
    const d1 = head({ kind: "DECISION", atMs: 3_208_000 });
    const d2 = head({ kind: "DECISION", atMs: 3_400_000 });
    const a2 = head({ kind: "AGENDA", content: "회고", atMs: 3_100_000 });
    const { groups } = selectTimeline(stateOf(a1, d1, d2, a2), "ALL");
    expect(groups[0]).toMatchObject({ startMs: 3_208_000, endMs: 3_400_000 });
  });

  it("안건이 없으면 머리 없는 묶음 하나다", () => {
    const { groups } = selectTimeline(
      stateOf(head({ kind: "DECISION" }), head({ kind: "ISSUE" })),
      "ALL"
    );
    expect(groups).toHaveLength(1);
    expect(groups[0].agenda).toBeNull();
    expect(groups[0].last).toBe(false);
  });

  it("답은 질문 안에 숨지 않고 제 자리에 서며 서로를 가리킨다", () => {
    const q = head({
      kind: "QUESTION",
      status: "CLOSED",
      closeReason: "RESOLVED",
    });
    const answer = head({
      kind: "DECISION",
      operation: "RESOLVE",
      resolvesProposalId: q.proposalId,
    });
    const items = selectTimeline(stateOf(q, answer), "ALL").groups[0].items;

    expect(items.map((i) => i.proposal.proposalId)).toEqual([
      q.proposalId,
      answer.proposalId,
    ]);
    expect(items[0].tone).toBe("answered");
    expect(items[0].answers.map((a) => a.proposalId)).toEqual([
      answer.proposalId,
    ]);
    expect(items[1].answersTo?.proposalId).toBe(q.proposalId);
  });

  it("골라 보기는 그 유형만 남기고, 빈 안건을 감추고, 개수는 전체에서 센다", () => {
    const a1 = head({ kind: "AGENDA" });
    const open = head({ kind: "QUESTION" });
    const a2 = head({ kind: "AGENDA" });
    const answered = head({
      kind: "QUESTION",
      status: "CLOSED",
      closeReason: "RESOLVED",
    });
    const report = head({ kind: "STATUS_REPORT" });
    const task = head({ kind: "ACTION_ITEM" });
    const issue = head({ kind: "ISSUE" });

    const state = stateOf(a1, open, a2, answered, report, task, issue);
    const opened = selectTimeline(state, "OPEN");
    expect(
      opened.groups.map((g) => g.items.map((i) => i.proposal.proposalId))
    ).toEqual([[open.proposalId], [issue.proposalId]]);
    // 답한 질문은 참고로 센다. 안건은 개수에 안 든다.
    expect(opened.counts).toEqual({
      ALL: 5,
      DECISION: 0,
      ACTION_ITEM: 1,
      OPEN: 2,
      REFERENCE: 2,
    });

    const decisions = selectTimeline(state, "DECISION");
    expect(decisions.groups).toEqual([]);
    // 「전체」에서는 아직 비어 있는 안건도 선다.
    expect(
      selectTimeline(stateOf(head({ kind: "AGENDA" })), "ALL").groups
    ).toHaveLength(1);
  });

  it("근거가 없는 후보는 시각이 빈다", () => {
    const items = selectTimeline(
      stateOf(head({ kind: "DECISION", atMs: null })),
      "ALL"
    ).groups[0].items;
    expect(items[0].atMs).toBeNull();
  });
});

describe("toneOf", () => {
  it("질문은 답이 났는지로, 이슈는 열린 질문으로, 보고·인사이트는 참고로 간다", () => {
    expect(toneOf(head({ kind: "QUESTION" }))).toBe("open");
    expect(
      toneOf(
        head({ kind: "QUESTION", status: "CLOSED", closeReason: "RESOLVED" })
      )
    ).toBe("answered");
    expect(toneOf(head({ kind: "ISSUE" }))).toBe("open");
    // 철회된 질문·이슈는 열려 있지 않다.
    expect(
      toneOf(
        head({ kind: "QUESTION", status: "CLOSED", closeReason: "RETRACTED" })
      )
    ).toBe("reference");
    expect(
      toneOf(
        head({ kind: "ISSUE", status: "CLOSED", closeReason: "RETRACTED" })
      )
    ).toBe("reference");
    expect(toneOf(head({ kind: "STATUS_REPORT" }))).toBe("reference");
    expect(toneOf(head({ kind: "INSIGHT" }))).toBe("reference");
    expect(toneOf(head({ kind: "ACTION_ITEM" }))).toBe("task");
  });
});

describe("바뀐 안건 정본", () => {
  it("재언급은 같은 안건 ID의 직전 묶음만 가리키며 필터로 가린 앞선 논의도 기억한다", () => {
    const a = head({ kind: "STATUS_REPORT" }),
      b = head({}),
      c = head({}),
      d = head({}),
      e = head({});
    const rows = [a, b, c, d, e];
    const list = {
      agendas: [
        {
          agendaId: "a",
          title: "같은 제목",
          completed: false,
          proposalIds: [a.proposalId, c.proposalId, e.proposalId],
        },
        {
          agendaId: "b",
          title: "같은 제목",
          completed: false,
          proposalIds: [b.proposalId, d.proposalId],
        },
      ],
    };
    const plan = {
      list,
      placement: placeAgendas(new Map(), rows, list, false),
    };
    const groups = selectTimeline(stateOf(...rows), "ALL", plan).groups;
    expect(groups[0].previous).toBeNull();
    expect(groups[1].previous).toBeNull();
    expect(groups[2].previous).toEqual({
      key: groups[0].key,
      startMs: groups[0].startMs,
    });
    expect(groups[3].previous?.key).toBe(groups[1].key);
    expect(groups[4].previous?.key).toBe(groups[2].key);
    const filtered = selectTimeline(stateOf(...rows), "DECISION", plan).groups;
    expect(filtered.some((group) => group.key === groups[0].key)).toBe(false);
    expect(
      filtered.find((group) => group.key === groups[2].key)?.previous?.key
    ).toBe(groups[0].key);
  });

  it("사라진 안건과 새로 소속이 생긴 미분류 항목은 최신 정본으로 옮긴다", () => {
    const a = head({}),
      b = head({});
    const previous = new Map([
      [a.proposalId, "removed"],
      [b.proposalId, null],
    ]);
    const list = {
      asOfSequence: b.createdSequence,
      agendas: [
        {
          agendaId: "current",
          title: "다시 정리한 안건",
          completed: false,
          proposalIds: [a.proposalId, b.proposalId],
        },
      ],
    };
    expect([...placeAgendas(previous, [a, b], list, true).values()]).toEqual([
      "current",
      "current",
    ]);
  });

  it("앞에 다른 안건이 추가되어도 기존 그룹의 key가 바뀌지 않는다", () => {
    const a = head({}),
      b = head({}),
      earlier = head({ createdSequence: a.createdSequence - 1 });
    const list = {
      agendas: [
        {
          agendaId: "a",
          title: "첫 안건",
          completed: false,
          proposalIds: [a.proposalId],
        },
        {
          agendaId: "b",
          title: "둘째 안건",
          completed: false,
          proposalIds: [b.proposalId],
        },
        {
          agendaId: "c",
          title: "앞에 추가된 안건",
          completed: false,
          proposalIds: [earlier.proposalId],
        },
      ],
    };
    const keys = (rows: ProposalHead[]) =>
      selectTimeline(stateOf(...rows), "ALL", {
        list,
        placement: placeAgendas(new Map(), rows, list, false),
      }).groups;
    expect(
      keys([a, b]).find((row) => row.agenda?.title === "둘째 안건")?.key
    ).toBe(
      keys([earlier, a, b]).find((row) => row.agenda?.title === "둘째 안건")
        ?.key
    );
  });
});
