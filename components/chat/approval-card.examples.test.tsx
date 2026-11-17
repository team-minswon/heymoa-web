import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ApprovalCard } from "@/components/chat/approval-card";
import { parseApprovalCard } from "@/lib/chat/stream-protocol";
import examples from "@/lib/chat/approval-cards.example.json";

type Example = { tool: string; card: unknown; summary: string };

function wordsOf(card: Record<string, unknown>): string[] {
  const fields = (list: unknown) =>
    ((list as Record<string, unknown>[] | undefined) ?? []).flatMap((field) => [
      field.label,
      field.value,
      field.before,
      field.after,
      ...((field.added as string[]) ?? []),
      ...((field.removed as string[]) ?? []),
      ...((field.kept as string[]) ?? []),
    ]);
  const items = (card.items as Record<string, unknown>[] | undefined) ?? [];
  const body = card.body as { label: string; text: string } | undefined;
  return [
    card.title,
    card.target,
    card.warning,
    ...fields(card.fields),
    ...items.flatMap((item) => [
      item.title,
      item.target,
      ...fields(item.fields),
    ]),
    body?.label,
    body?.text,
  ].filter((word): word is string => typeof word === "string" && word !== "");
}

afterEach(cleanup);

describe("공용 승인 카드 예시", () => {
  it("승인을 묻는 도구 20종이 전부 있다", () => {
    expect((examples as Example[]).map((each) => each.tool)).toHaveLength(20);
  });

  it.each((examples as Example[]).map((each) => [each.tool, each] as const))(
    "%s — 카드가 실어 보낸 말을 빠짐없이 평문으로 그리고 도구 이름은 안 보인다",
    (tool, example) => {
      const card = parseApprovalCard(example.card);
      expect(card).not.toBeNull();

      const { container } = render(
        <ApprovalCard
          card={card}
          summary={example.summary}
          status={{ kind: "open" }}
        />
      );
      const text = (container.textContent ?? "").replace(/\s+/g, " ");
      for (const word of wordsOf(example.card as Record<string, unknown>)) {
        expect(text).toContain(word.replace(/\s+/g, " "));
      }
      expect(text).not.toContain(tool);
      expect(container.querySelector("a, strong, em, b")).toBeNull();
    }
  );
});
