import { describe, expect, it } from "vitest";
import {
  overviewText,
  type MeetingReviewSummary,
} from "@/lib/notes/review/summary";
import { topicDigests } from "@/lib/notes/review/topics";
import {
  overviewToMarkdown,
  topicsToMarkdown,
} from "@/lib/notes/review/markdown";

const summary = {
  headline: { text: "회의를 구별하는 제목 후보", topics: [1] },
  lead: [
    { text: "첫 번째 회의 정리.", topics: [1] },
    { text: "두 번째 회의 정리.", topics: [1] },
  ],
  agendas: [
    {
      agendaId: "agenda",
      ordinal: 1,
      title: "검토할 안건",
      summary:
        "첫 문장. 두 번째 문장은 생략하지 않습니다. 마지막 문장까지 전달합니다.",
      members: [],
      openItemIds: [],
      description: [],
      conclusions: [],
      openItems: [],
    },
  ],
} as unknown as MeetingReviewSummary;

describe("최종 요약의 공통 내용 선택", () => {
  it("정리를 제목 후보보다 우선하고 화면과 복사에서 같은 전문을 쓴다", () => {
    expect(overviewText(summary)).toBe("첫 번째 회의 정리. 두 번째 회의 정리.");
    expect(overviewToMarkdown(summary)).toContain(overviewText(summary));
    expect(overviewToMarkdown(summary)).not.toContain(summary.headline!.text);
  });

  it("회의 정리가 없거나 공백뿐인 옛 응답은 제목 후보로 대체한다", () => {
    expect(overviewText({ ...summary, lead: [] })).toBe(summary.headline!.text);
    expect(
      overviewText({ ...summary, lead: [{ text: "  ", topics: [] }] })
    ).toBe(summary.headline!.text);
    expect(overviewText({ ...summary, lead: [], headline: null })).toBe("");
  });

  it("안건 요약은 문장·길이 제한 없이 화면·복사·PDF 공통 입력에 남는다", () => {
    const [topic] = topicDigests(summary, new Map(), () => null);
    expect(topic.text).toBe(summary.agendas[0].summary);
    expect(topic.gist).toBe(topic.text);
    expect(topicsToMarkdown([topic])).toContain("마지막 문장까지 전달합니다.");
  });
});
