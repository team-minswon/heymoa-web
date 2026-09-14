import { describe, expect, it } from "vitest";

import {
  overviewToMarkdown,
  reviewSectionToMarkdown,
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
  it("개요는 한 문단, 주제는 번호 목록이다", () => {
    const summary = {
      lead: [
        { text: "문제를 좁혔다.", topics: [] },
        { text: "요금은\n다시 본다.", topics: [] },
      ],
    } as unknown as MeetingReviewSummary;
    expect(overviewToMarkdown(summary)).toBe("## 개요\n\n문제를 좁혔다. 요금은 다시 본다.\n");
    expect(
      topicsToMarkdown([
        { ordinal: 1, title: "문제 정의", count: 2, gist: "한 문장으로 좁혔다." },
        { ordinal: 2, title: "요금", count: 1, gist: null },
      ])
    ).toBe("## 주제\n\n1. **문제 정의** — 한 문장으로 좁혔다.\n2. **요금**\n");
  });
});
