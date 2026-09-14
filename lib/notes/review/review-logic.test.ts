import { describe, expect, it } from "vitest";

import type {
  ProposalRevision,
  TranscriptResponseDataSegmentsItem,
} from "@/lib/api/generated/models";
import {
  choiceOf,
  confirmBlockReason,
  confirmSummaryOf,
  unchosenSuggestionCount,
} from "@/lib/notes/review/confirm";
import { sectionsOf, type ReviewItem } from "@/lib/notes/review/sections";
import type { MeetingReviewSummary } from "@/lib/notes/review/summary";
import { resolvedItemIds } from "@/lib/notes/review/topics";
import { trailOf } from "@/lib/notes/review/trail";

const replacement = (itemId: string, decision: "END" | "KEEP" | null = null): ReviewItem["replacements"][number] => ({
  target: {
    itemId,
    revision: 1,
    kind: "DECISION",
    content: "이전 결정",
    noteId: "01K0000000024",
    noteTitle: "지난 회의",
    approvedAt: "2026-09-04T00:00:00Z",
    endedAt: null,
  },
  kind: "SUPERSEDES",
  label: "대체",
  reason: "",
  decision,
});

const item = (over: Partial<ReviewItem> & Pick<ReviewItem, "itemId" | "kind">): ReviewItem => ({
  revision: 1,
  content: over.itemId,
  included: true,
  edited: false,
  authoredByUserId: null,
  originalProposalRef: null,
  citations: [],
  assignee: null,
  due: null,
  replacements: [],
  taskChanges: [],
  ...over,
});

describe("sectionsOf", () => {
  const items = [
    item({ itemId: "d1", kind: "DECISION" }),
    item({
      itemId: "d2",
      kind: "DECISION",
      replacements: [replacement("old")],
    }),
    item({ itemId: "t1", kind: "ACTION_ITEM", included: false }),
    item({ itemId: "q1", kind: "QUESTION" }),
    item({ itemId: "r1", kind: "INSIGHT" }),
  ];
  const topics = new Map([
    ["d1", 1],
    ["d2", 2],
    ["q1", 2],
  ]);
  const topicOf = (id: string) => topics.get(id) ?? null;

  it("제안이 붙은 항목이 먼저 서고, 제외한 항목은 자리를 지키되 세지 않는다", () => {
    const [decisions, actions, open, reference] = sectionsOf(items, topicOf);
    expect(decisions.items.map((row) => row.itemId)).toEqual(["d2", "d1"]);
    expect(actions.items).toHaveLength(1);
    expect(actions.includedCount).toBe(0);
    expect(open.label).toBe("이슈 · 질문");
    expect(reference.kindCounts).toEqual([{ kind: "INSIGHT", label: "인사이트", count: 1 }]);
  });

  it("주제를 고르면 그 주제의 항목만 남는다", () => {
    const sections = sectionsOf(items, topicOf, 2);
    expect(sections.flatMap((row) => row.items).map((row) => row.itemId)).toEqual(["d2", "q1"]);
  });
});

describe("confirmSummaryOf", () => {
  it("포함 항목에 저장된 끝내기만 끝낼 것으로 세고, 반영한 할 일 변경을 센다", () => {
    const items = [
      item({
        itemId: "d",
        kind: "DECISION",
        replacements: [
          replacement("n1", "END"),
          replacement("n2", "KEEP"),
          replacement("n3"),
          // 다른 확정이 먼저 끝낸 결정은 끝내기로 저장돼 있어도 이번 확정이 끝내지 않는다.
          { ...replacement("n5", "END"), target: { ...replacement("n5").target, endedAt: "2026-09-10T00:00:00Z" } },
        ],
      }),
      item({ itemId: "x", kind: "DECISION", included: false, replacements: [replacement("n4", "END")] }),
      item({
        itemId: "t",
        kind: "ACTION_ITEM",
        taskChanges: [
          { target: { itemId: "task", revision: 2 }, status: "COMPLETED", assignee: null, due: null, reason: "", decision: "APPLIED" },
        ],
      }),
    ];
    expect(confirmSummaryOf(items)).toEqual({ newTasks: 1, endedDecisions: 1, changedTasks: 1 });
  });

  it("저장 · 반영이 끝나지 않았거나 변경 제안의 할 일을 못 읽었으면 확정을 막는다", () => {
    const base = { saving: false, applyingTasks: false, hasTaskChanges: true, tasks: "ready" as const, unchosen: 0 };
    expect(confirmBlockReason(base)).toBeNull();
    expect(confirmBlockReason({ ...base, unchosen: 2 })).toBe("고르지 않은 제안이 2개 남았습니다");
    expect(confirmBlockReason({ ...base, saving: true })).toBe("저장이 끝나면 완료할 수 있습니다");
    expect(confirmBlockReason({ ...base, applyingTasks: true })).toBe("기존 할 일에 반영하는 중입니다");
    expect(confirmBlockReason({ ...base, tasks: "pending" })).toBe("기존 할 일 변경 제안을 불러오는 중입니다");
    expect(confirmBlockReason({ ...base, tasks: "failed" })).toMatch(/불러오지 못해/);
    // 변경 제안이 없으면 할 일 조회를 기다릴 까닭이 없다.
    expect(confirmBlockReason({ ...base, hasTaskChanges: false, tasks: "failed" })).toBeNull();
  });

  it("고를 수 있는데 안 고른 제안만 센다", () => {
    const ended = { ...replacement("n9"), target: { ...replacement("n9").target, endedAt: "2026-09-10T00:00:00Z" } };
    const change = (taskId: string, decision: "APPLIED" | "KEEP" | null) => ({
      target: { itemId: taskId, revision: 1 },
      status: "COMPLETED" as const,
      assignee: null,
      due: null,
      reason: "",
      decision,
    });
    const items = [
      item({ itemId: "d", kind: "DECISION", replacements: [replacement("n1"), replacement("n2", "KEEP"), ended] }),
      item({ itemId: "x", kind: "DECISION", included: false, replacements: [replacement("n3")] }),
      item({ itemId: "t", kind: "ACTION_ITEM", taskChanges: [change("known", null), change("gone", null), change("done", "APPLIED")] }),
    ];
    expect(unchosenSuggestionCount(items, (taskId) => taskId !== "gone")).toBe(2);
  });

  it("저장된 선택을 두 칸 토글의 값으로 읽는다", () => {
    expect(choiceOf("END")).toBe("change");
    expect(choiceOf("APPLIED")).toBe("change");
    expect(choiceOf("KEEP")).toBe("keep");
    expect(choiceOf(null)).toBeNull();
  });
});

describe("resolvedItemIds", () => {
  it("풀어 준 항목이 있는 이슈만 해결로 본다", () => {
    const summary = {
      topics: [
        {
          outline: {
            issues: [
              { itemId: "still-open", backgroundItemIds: [], resolvedByItemIds: [] },
              { itemId: "answered", backgroundItemIds: [], resolvedByItemIds: ["d1"] },
            ],
          },
        },
      ],
    } as unknown as MeetingReviewSummary;
    expect([...resolvedItemIds(summary)]).toEqual(["answered"]);
    expect(resolvedItemIds(null).size).toBe(0);
  });
});

describe("trailOf", () => {
  const segment = (n: number): TranscriptResponseDataSegmentsItem => ({
    segmentId: `s${n}`,
    sequence: n + 1,
    startedAtMs: n * 1000,
    endedAtMs: n * 1000 + 900,
    text: `line ${n}`,
    speakerLabel: "A",
    assignedParticipantId: null,
  });
  const segments = Array.from({ length: 6 }, (_, n) => segment(n));
  const revision = (n: number, operation: ProposalRevision["operation"], at: number, content: string) =>
    ({
      proposalId: "p",
      revision: n,
      operation,
      kind: "DECISION",
      status: "OPEN",
      closeReason: null,
      revisionSource: "LIVE",
      content,
      createdSequence: 1,
      lastEvidenceSequence: at + 1,
      aiSemanticRevisionCount: n - 1,
      resolvesProposalId: null,
      citations: [{ ...segments[at], role: operation === "CORRECT" ? "REFUTES" : "SUPPORTS" }],
    }) as ProposalRevision;

  it("최근 단계가 위고, 인용 줄에 앞뒤 한 줄과 역할이 붙는다", () => {
    const steps = trailOf({
      revisions: [revision(1, "CREATE", 1, "처음"), revision(2, "CORRECT", 4, "고침")],
      segments,
      currentContent: "고침",
      edited: false,
    });
    expect(steps.map((step) => step.label)).toEqual(["고쳐 말함", "처음 나옴"]);
    expect(steps[0].lines.map((line) => line.segmentId)).toEqual(["s3", "s4", "s5"]);
    expect(steps[0].lines.find((line) => line.segmentId === "s4")?.role).toBe("REFUTES");
  });

  it("검토에서 고친 내용은 스크립트 없이 맨 위에 선다", () => {
    const steps = trailOf({
      revisions: [revision(1, "CREATE", 0, "처음")],
      segments,
      currentContent: "사람이 고침",
      edited: true,
    });
    expect(steps[0]).toMatchObject({ label: "검토에서 수정", content: "처음 → 사람이 고침", lines: [] });
  });
});
