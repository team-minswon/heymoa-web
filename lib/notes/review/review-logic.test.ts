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
import { linkedItemsOf, topicDigests } from "@/lib/notes/review/topics";
import { trailOf } from "@/lib/notes/review/trail";

const replacement = (itemId: string, decision: "END" | "KEEP" | null = null): ReviewItem["replacements"][number] => ({
  target: {
    itemId,
    revision: 1,
    kind: "DECISION",
    content: "이전 결정",
    noteId: "01K0000000024",
    noteTitle: "지난 회의",
    originalProposalRef: null,
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
  decisions: [],
  suggestedAssignment: null,
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
    expect(reference.items.map((row) => row.itemId)).toEqual(["r1"]);
  });

  it("주제를 고르면 그 주제의 항목만 남는다", () => {
    const sections = sectionsOf(items, topicOf, 2);
    expect(sections.flatMap((row) => row.items).map((row) => row.itemId)).toEqual(["d2", "q1"]);
  });
});

describe("confirmSummaryOf", () => {
  it("확정 전 APPLY와 APPLIED를 변경 안내에 포함하되 같은 할 일은 한 번만 센다", () => {
    const change = (decision: "APPLY" | "APPLIED" | "KEEP") => ({
      target: { itemId: "task", revision: 1, originalProposalRef: null },
      status: "COMPLETED" as const,
      assignee: null,
      due: null,
      draft: decision === "APPLY" ? { expectedRevision: 1, status: "COMPLETED" as const, assignee: null, due: null } : null,
      reason: "",
      decision,
    });
    expect(confirmSummaryOf([item({ itemId: "review", kind: "DECISION", taskChanges: [change("APPLY")] })]).changedTasks).toBe(1);
    expect(confirmSummaryOf([item({ itemId: "review", kind: "DECISION", taskChanges: [change("APPLY"), change("APPLIED")] })]).changedTasks).toBe(1);
    expect(confirmSummaryOf([item({ itemId: "review", kind: "DECISION", taskChanges: [change("KEEP")] })]).changedTasks).toBe(0);
    expect(confirmSummaryOf([item({ itemId: "review", kind: "DECISION", included: false, taskChanges: [change("APPLY")] })]).changedTasks).toBe(0);
  });
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
          { target: { itemId: "task", revision: 2, originalProposalRef: null }, status: "COMPLETED", assignee: null, due: null, draft: null, reason: "", decision: "APPLIED" },
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
      target: { itemId: taskId, revision: 1, originalProposalRef: null },
      status: "COMPLETED" as const,
      assignee: null,
      due: null,
      draft: null,
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
    expect(choiceOf("APPLY")).toBe("change");
    expect(choiceOf("KEEP")).toBe("keep");
    expect(choiceOf(null)).toBeNull();
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

describe("topicDigests", () => {
  const summary = {
    agendas: [
      {
        ordinal: 1,
        title: "가",
        agendaId: "01KG000000001",
        summary: "한 줄 요약",
        conclusions: [],
        description: [{ text: "첫 문장." }, { text: "둘째 문장." }],
        members: [{ itemId: "d" }, { itemId: "t" }, { itemId: "out" }, { itemId: "gone" }],
        openItemIds: ["q"],
      },
      { ordinal: 2, title: "나", summary: null, conclusions: [], description: [], members: [{ itemId: "early" }], openItemIds: [] },
      { ordinal: 3, title: "다", summary: null, conclusions: [], description: [], members: [], openItemIds: [] },
    ],
  } as unknown as MeetingReviewSummary;
  const items = [
    item({ itemId: "d", kind: "DECISION" }),
    item({ itemId: "t", kind: "ACTION_ITEM" }),
    item({ itemId: "out", kind: "DECISION", included: false }),
    item({ itemId: "q", kind: "QUESTION" }),
    item({ itemId: "early", kind: "DECISION" }),
  ];
  const at: Record<string, number> = { d: 5_000, t: 9_000, q: 7_000, early: 1_000 };
  const digests = topicDigests(summary, new Map(items.map((row) => [row.itemId, row])), (row) => at[row.itemId] ?? null);

  it("뺀 항목 · 없는 항목은 싣지 않고, 결정 · 할 일 · 열린 질문으로 나눈다", () => {
    const first = digests.find((row) => row.ordinal === 1)!;
    expect(first.decisions.map((row) => row.itemId)).toEqual(["d"]);
    expect(first.tasks.map((row) => row.itemId)).toEqual(["t"]);
    expect(first.open.map((row) => row.itemId)).toEqual(["q"]);
    expect(first.count).toBe(2);
    // 한 줄은 서버의 summary, 펼친 서술은 description 이다
    expect(first).toMatchObject({ gist: "한 줄 요약", text: "첫 문장. 둘째 문장.", startMs: 5_000, endMs: 9_000 });
    expect(digests.find((row) => row.ordinal === 2)?.gist).toBeNull();
  });

  it("사람이 주제에 직접 더한 질문 · 이슈도 남은 것으로 싣는다 — 분석이 답한 질문(사람이 쓰지 않은 것)은 아니다", () => {
    const rows = topicDigests(
      {
        agendas: [
          {
            ordinal: 1,
            title: "가",
            agendaId: "01KG000000001",
            summary: null,
            conclusions: [],
            description: [],
            members: [{ itemId: "mine" }, { itemId: "answered" }],
            openItemIds: [],
          },
        ],
      } as unknown as MeetingReviewSummary,
      new Map([
        ["mine", item({ itemId: "mine", kind: "ISSUE", authoredByUserId: "01KU000000001" })],
        ["answered", item({ itemId: "answered", kind: "QUESTION", authoredByUserId: null })],
      ]),
      () => null
    );
    expect(rows[0].open.map((row) => row.itemId)).toEqual(["mine"]);
  });

  it("한 줄 요약이 없으면 서술(설명)의 첫 문장을 쓴다", () => {
    const rows = topicDigests(
      {
        agendas: [
          { ordinal: 1, title: "가", agendaId: "01KG000000001", summary: null, conclusions: [{ text: "결론." }], description: [{ text: "설명." }], members: [], openItemIds: [] },
          { ordinal: 2, title: "나", agendaId: "01KG000000002", summary: null, conclusions: [], description: [{ text: "설명만." }], members: [], openItemIds: [] },
        ],
      } as unknown as MeetingReviewSummary,
      new Map(),
      () => null
    );
    expect(rows.map((row) => row.gist)).toEqual(["설명.", "설명만."]);
  });

  it("처음 나온 때 차례이고 때를 모르는 주제는 끝에 선다", () => {
    expect(digests.map((row) => row.ordinal)).toEqual([2, 1, 3]);
  });

  it("안건 행이 없는 옛 요약만 합친 문장을 서술로 쓰고, 새 안건은 설명만 쓴다", () => {
    const summary = {
      agendas: [
        { ordinal: 1, title: "옛", agendaId: null, summary: null, conclusions: [], description: [], sentences: [{ text: "옛 서술." }], members: [], openItemIds: [] },
        { ordinal: 2, title: "지운 뒤", agendaId: null, summary: null, conclusions: [], description: [], members: [], openItemIds: [] },
        // 새 안건의 합친 문장에는 결론이 섞여 있다 — 설명이 비어도 그것을 서술로 쓰지 않는다
        { ordinal: 3, title: "새", agendaId: "01KG000000003", summary: null, conclusions: [{ text: "결론." }], description: [], sentences: [{ text: "결론." }], members: [], openItemIds: [] },
      ],
    } as unknown as MeetingReviewSummary;
    const rows = topicDigests(summary, new Map(), () => null);
    expect(rows.map((row) => [row.text, row.gist])).toEqual([
      ["옛 서술.", "옛 서술."],
      ["", null],
      ["", null],
    ]);
  });
});

describe("linkedItemsOf", () => {
  it("주제의 안건 항목에서 나가는 소속 관계는 관련 항목이 아니다", () => {
    const relation = (sourceItemId: string, targetItemId: string, label: string) => ({ sourceItemId, targetItemId, kind: "X", label });
    const summary = {
      agendas: [
        {
          ordinal: 1,
          members: [{ itemId: "g", kind: "AGENDA" }, { itemId: "d", kind: "DECISION" }, { itemId: "t", kind: "ACTION_ITEM" }],
          relations: [relation("g", "d", "주제"), relation("d", "t", "후속")],
        },
      ],
    } as unknown as MeetingReviewSummary;
    expect(linkedItemsOf(summary, "d")).toEqual([{ itemId: "t", label: "후속" }]);
  });
});
