import { describe, expect, it } from "vitest";

import { buildMinutes } from "@/lib/notes/minutes/model";
import { buildReviewGraph } from "@/lib/notes/review/graph-model";
import { reviewToMarkdown } from "@/lib/notes/review/markdown";
import { sectionsOf, type ReviewItem } from "@/lib/notes/review/sections";
import type { MeetingReviewSummary } from "@/lib/notes/review/summary";
import { topicDigests } from "@/lib/notes/review/topics";

const items = [
  { itemId: "d", kind: "DECISION", content: "확정한 결론", included: true },
  { itemId: "q", kind: "QUESTION", content: "남은 일", included: true },
] as ReviewItem[];

// 서버 제거를 앞둔 실제 전송 모양입니다. 생성 계약은 호환 단계라 옛 필드를 아직 필수로 선언합니다.
const summary = {
  noteId: "n", status: "SUCCEEDED", resultVersion: "v", headline: null, lead: [],
  agendas: [
    {
      ordinal: 1, agendaId: null, title: "옛 안건", summary: null, completed: true,
      members: [{ itemId: "d", kind: "DECISION" }, { itemId: "q", kind: "QUESTION" }],
      memberships: [{ itemId: "d", secondary: false }, { itemId: "q", secondary: false }],
      description: [{ text: "옛 설명 첫 줄\n둘째 줄", itemIds: [] }],
      conclusions: [{ text: "확정한 결론", itemIds: ["d"] }],
      openItems: [{ text: "남은 일", itemIds: ["q"] }],
      openItemIds: ["q"], relations: [],
    },
    {
      ordinal: 2, agendaId: "a2", title: "이어진 안건", summary: null, completed: false,
      members: [], memberships: [{ itemId: "d", secondary: true }],
      description: [], conclusions: [], openItems: [], openItemIds: [], relations: [],
    },
  ],
} as unknown as MeetingReviewSummary;

describe("옛 표시 필드가 없는 요약 계약", () => {
  it("화면과 복사·PDF 문서가 옛 설명 전문과 결정·남은 일을 같은 내용으로 보존한다", () => {
    const topics = topicDigests(summary, new Map(items.map((item) => [item.itemId, item])), () => null);
    const sections = sectionsOf(items, () => 1);
    const note = { title: "회의", whenIso: "2026-10-20T00:00:00Z", participantCount: 1 };
    const markdown = reviewToMarkdown({ note, summary, topics, sections });
    const minutes = buildMinutes({ note, topics, sections, citedAt: () => null, include: { transcript: false } });

    expect(topics[0].text).toBe("옛 설명 첫 줄\n둘째 줄");
    expect(topics[0].conclusions).toEqual(summary.agendas[0].conclusions);
    expect(topics[0].openItems).toEqual(summary.agendas[0].openItems);
    expect(minutes.agendas[0].text).toBe(topics[0].text);
    for (const text of ["옛 설명 첫 줄", "둘째 줄", "확정한 결론", "남은 일"]) {
      expect(markdown).toContain(text);
    }
    expect(minutes.decisions[0].text).toBe("확정한 결론");
    expect(minutes.open[0].content).toBe("남은 일");
  });

  it("주 소속과 보조 소속만으로 그래프를 만들고 중복·보조 전용 항목도 보존한다", () => {
    const input = structuredClone(summary);
    input.agendas[0].memberships.push({ itemId: "d", secondary: true });
    input.agendas[1].memberships.push({ itemId: "q", secondary: true });
    input.agendas[0].memberships = input.agendas[0].memberships.filter((member) => member.itemId !== "q");
    const graph = buildReviewGraph(input, items);
    expect(graph.nodes.map(({ id, group, alsoGroups }) => ({ id, group, alsoGroups }))).toEqual([
      { id: "d", group: 1, alsoGroups: [2] },
      { id: "q", group: 2, alsoGroups: [] },
    ]);
  });
});
