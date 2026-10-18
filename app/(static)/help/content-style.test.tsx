import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { helpTopics } from "@/app/(static)/help/_content/topics";
import { textOf } from "@/lib/help/text";

vi.mock("next/navigation", () => ({ usePathname: () => "/help" }));

/** 따옴표 안(화면에 뜨는 문구)은 화면의 말투 그대로 두므로 검사에서 뺀다. */
const withoutQuoted = (text: string) => text.replace(/“[^”]*”/g, "");

const textsOf = (topic: (typeof helpTopics)[number]) => [
  topic.title,
  topic.summary,
  ...topic.sections.flatMap((s) => [s.title, ...s.body.map(textOf)]),
];

describe("도움말 문체", () => {
  it("모든 본문이 그려지고 가이드 안 링크가 풀린다", () => {
    for (const topic of helpTopics) {
      const { container } = render(
        <div>{topic.sections.flatMap((s) => s.body)}</div>
      );
      expect(container.textContent?.length, topic.slug).toBeGreaterThan(40);
      expect(container.innerHTML, topic.slug).not.toContain('href="help:');
    }
  });

  it("낫표를 쓰지 않는다", () => {
    for (const topic of helpTopics) {
      for (const text of textsOf(topic)) {
        expect(text, topic.slug).not.toMatch(/[「」『』]/);
      }
    }
  });

  it("해요체로 쓴다 (합쇼체 어미가 없다)", () => {
    for (const topic of helpTopics) {
      for (const text of textsOf(topic)) {
        expect(withoutQuoted(text), topic.slug).not.toMatch(
          /(합니다|습니다|입니다|됩니다|십시오)[.\s)]|(합니다|습니다|입니다|됩니다)$/
        );
      }
    }
  });

  it("상황별 단계에는 번호 목록이 있다", () => {
    for (const topic of helpTopics.filter((t) => t.group === "situations")) {
      const steps = topic.sections.find((s) => s.id === "steps");
      expect(steps, topic.slug).toBeDefined();
    }
  });
});
