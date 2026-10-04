import { describe, expect, it } from "vitest";

import {
  initialContextState,
  type ContextState,
  type ProposalHead,
} from "@/lib/notes/proposals/reducer";
import { selectTimeline, toneOf } from "@/lib/notes/proposals/timeline";

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
    const a1 = head({ kind: "AGENDA", content: "MongoDB 도입 검토", atMs: 120_000 });
    const d1 = head({ kind: "DECISION", atMs: 180_000 });
    const a2 = head({ kind: "AGENDA", content: "다음 스프린트 범위", atMs: 240_000 });
    const t1 = head({ kind: "ACTION_ITEM", atMs: 300_000 });

    // 도착 순서와 상관없이 createdSequence 로 선다.
    const { groups } = selectTimeline(stateOf(t1, a2, d1, early, a1), "ALL");

    expect(groups.map((g) => g.agenda?.content ?? null)).toEqual([
      null,
      "MongoDB 도입 검토",
      "다음 스프린트 범위",
    ]);
    expect(groups.map((g) => g.items.map((i) => i.proposal.proposalId))).toEqual([
      [early.proposalId],
      [d1.proposalId],
      [t1.proposalId],
    ]);
    // 안건의 끝은 다음 안건의 시작이고, 마지막 안건만 열려 있다.
    expect(groups[1]).toMatchObject({ startMs: 120_000, endMs: 240_000, last: false });
    expect(groups[2]).toMatchObject({ startMs: 240_000, endMs: null, last: true });
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
    const q = head({ kind: "QUESTION", status: "CLOSED", closeReason: "RESOLVED" });
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
    expect(items[0].answers.map((a) => a.proposalId)).toEqual([answer.proposalId]);
    expect(items[1].answersTo?.proposalId).toBe(q.proposalId);
  });

  it("골라 보기는 그 유형만 남기고, 빈 안건을 감추고, 개수는 전체에서 센다", () => {
    const a1 = head({ kind: "AGENDA" });
    const open = head({ kind: "QUESTION" });
    const a2 = head({ kind: "AGENDA" });
    const answered = head({ kind: "QUESTION", status: "CLOSED", closeReason: "RESOLVED" });
    const report = head({ kind: "STATUS_REPORT" });
    const task = head({ kind: "ACTION_ITEM" });
    const issue = head({ kind: "ISSUE" });

    const state = stateOf(a1, open, a2, answered, report, task, issue);
    const opened = selectTimeline(state, "OPEN");
    expect(opened.groups.map((g) => g.items.map((i) => i.proposal.proposalId))).toEqual([
      [open.proposalId],
      [issue.proposalId],
    ]);
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
    expect(selectTimeline(stateOf(head({ kind: "AGENDA" })), "ALL").groups).toHaveLength(1);
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
      toneOf(head({ kind: "QUESTION", status: "CLOSED", closeReason: "RESOLVED" }))
    ).toBe("answered");
    expect(toneOf(head({ kind: "ISSUE" }))).toBe("open");
    // 철회된 질문·이슈는 열려 있지 않다.
    expect(
      toneOf(head({ kind: "QUESTION", status: "CLOSED", closeReason: "RETRACTED" }))
    ).toBe("reference");
    expect(
      toneOf(head({ kind: "ISSUE", status: "CLOSED", closeReason: "RETRACTED" }))
    ).toBe("reference");
    expect(toneOf(head({ kind: "STATUS_REPORT" }))).toBe("reference");
    expect(toneOf(head({ kind: "INSIGHT" }))).toBe("reference");
    expect(toneOf(head({ kind: "ACTION_ITEM" }))).toBe("task");
  });
});
