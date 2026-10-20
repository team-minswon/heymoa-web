import { describe, expect, it } from "vitest";

import {
  markdownToText,
  overviewToMarkdown,
  reviewSectionToMarkdown,
  reviewToMarkdown,
  topicsToMarkdown,
} from "@/lib/notes/review/markdown";
import { sectionsOf, type ReviewItem } from "@/lib/notes/review/sections";
import type { MeetingReviewSummary } from "@/lib/notes/review/summary";

const item = (over: Partial<ReviewItem>): ReviewItem => ({
  itemId: "i",
  revision: 1,
  kind: "DECISION",
  content: "",
  included: true,
  projectSelected: true,
  edited: false,
  authoredByUserId: null,
  originalProposalRef: null,
  citations: [],
  assignee: null,
  due: null,
  decisions: [],
  replacements: [],
  taskChanges: [],
  suggestedAssignment: null,
  ...over,
});

describe("reviewSectionToMarkdown", () => {
  const [decisions, actions, open] = sectionsOf(
    [
      item({
        itemId: "a",
        kind: "ACTION_ITEM",
        content: "요금표를\n정리한다",
        assignee: { type: "USER", id: "u1", name: "김민" } as ReviewItem["assignee"],
        due: "2026-09-19",
      }),
      item({ itemId: "b", kind: "ACTION_ITEM", content: "뺀 일", included: false }),
      item({
        itemId: "c",
        kind: "ACTION_ITEM",
        content: "화자에게 걸린 일",
        assignee: { type: "SPEAKER_LABEL", noteId: "n", label: "B" } as ReviewItem["assignee"],
      }),
      item({ itemId: "d", kind: "QUESTION", content: "요금 기준은?" }),
    ],
    () => null
  );

  it("뺀 항목은 싣지 않고, 할 일에는 담당 · 기한을 붙인다", () => {
    expect(reviewSectionToMarkdown(actions)).toBe(
      "## 할 일\n\n- 요금표를 정리한다 — 담당 김민 · 기한 9월 19일 (토)\n- 화자에게 걸린 일 — 담당 화자 B\n"
    );
  });

  it("여러 종류가 섞인 섹션은 종류를 앞에 적고, 주제로 걸렀으면 제목에 밝힌다", () => {
    expect(reviewSectionToMarkdown(open, "차별점과 요금")).toBe(
      "## 이슈 · 질문 — 차별점과 요금\n\n- **질문** 요금 기준은?\n"
    );
  });

  it("빈 섹션도 비었다고 적는다", () => {
    expect(reviewSectionToMarkdown(decisions)).toBe("## 결정\n\n_없음_\n");
  });
});

describe("overview · topics", () => {
  it("요약은 한 문단, 주제는 번호 목록이다", () => {
    const summary = {
      lead: [
        { text: "문제를 좁혔다.", topics: [] },
        { text: "요금은\n다시 본다.", topics: [] },
      ],
    } as unknown as MeetingReviewSummary;
    expect(overviewToMarkdown(summary)).toBe("## 요약\n\n문제를 좁혔다. 요금은 다시 본다.\n");
    // 제목 후보가 있어도 회의 정리를 가리지 않는다
    expect(overviewToMarkdown({ ...summary, headline: { text: "할 일을 주제별로 확정한다", topics: [] } })).toBe(
      "## 요약\n\n문제를 좁혔다. 요금은 다시 본다.\n"
    );
    expect(
      topicsToMarkdown([
        { ordinal: 1, title: "문제 정의", count: 2, gist: "한 문장으로 좁혔다." },
        { ordinal: 2, title: "요금", count: 1, gist: null },
      ])
    ).toBe("## 주제\n\n1. **문제 정의** — 한 문장으로 좁혔다.\n2. **요금**\n");
  });
});

describe("reviewToMarkdown", () => {
  const note = {
    title: "주간 회의",
    whenIso: "2026-10-12T04:51:00.000Z",
    participantCount: 2,
  };
  const topics = [{ ordinal: 1, title: "표시 기능", gist: "15초마다 갱신" }] as never;
  const section = (included: boolean) =>
    ({
      key: "DECISION",
      label: "결정",
      includedCount: included ? 1 : 0,
      items: [{ included, kind: "DECISION", content: "다운로드를 아래에 둔다", assignee: null, due: null }],
    }) as never;

  it("머리말·주제·결정을 한 문서로 잇고 뺀 항목만 있는 섹션은 싣지 않는다", () => {
    const out = reviewToMarkdown({ note, summary: null, topics, sections: [section(true), section(false)] });
    expect(out).toContain("# 주간 회의");
    expect(out).toContain("## 주제");
    expect(out).toContain("- 다운로드를 아래에 둔다");
    expect(out.match(/## 결정/g)).toHaveLength(1);
    // 요약이 아직 안 왔으면 요약 머리도 없다
    expect(out).not.toContain("## 요약");
  });

  it("결정에 나온 때와 속한 주제를 붙이고, 주제는 때와 함께 시간순 번호로 적는다", () => {
    const withTime = [
      { ordinal: 5, title: "에이전트", gist: null, startMs: 7_000 },
      { ordinal: 3, title: "홍보", gist: null, startMs: 248_000 },
    ] as never;
    const out = reviewToMarkdown({
      note: { ...note, durationMs: 540_000, projectName: "멘토링" },
      summary: null,
      topics: withTime,
      sections: [section(true)],
      confirmed: true,
      context: { whenOf: () => 290_000, topicTitleOf: () => "홍보" },
    });
    // ordinal(5, 3)이 아니라 목록 차례(1, 2)로 센다
    expect(out).toContain("1. [00:07] **에이전트**");
    expect(out).toContain("2. [04:08] **홍보**");
    expect(out).toContain("- 다운로드를 아래에 둔다 ([04:50] · 주제: 홍보)");
    // 머리말 사실 줄에 기록 시간 · 프로젝트 · 확정 여부
    expect(out).toContain("기록 9분 · 프로젝트 멘토링 · 확정됨");
  });

  it("검토 중이면 그렇게 적는다", () => {
    const out = reviewToMarkdown({ note, summary: null, topics, sections: [], confirmed: false });
    expect(out).toContain("검토 중");
  });

  it("텍스트 형식은 헤딩·굵게·불릿 기호를 걷어 낸다", () => {
    expect(markdownToText("## 주제\n\n1. **표시** — 설명\n- 항목\n_없음_\n")).toBe("주제\n\n1. 표시 — 설명\n• 항목\n없음\n");
  });
});
