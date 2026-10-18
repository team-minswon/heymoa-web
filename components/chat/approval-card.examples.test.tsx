import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ApprovalCard } from "@/components/chat/approval-card";
import { parseApprovalCard } from "@/lib/chat/stream-protocol";
import examples from "@/lib/chat/approval-cards.example.json";

/**
 * 세 레포가 같은 예시로 맞춘다. 원본은 docs `contracts/examples/approval-cards.json` 이고, ai 의
 * 실제 카드 빌더가 승인 도구마다 낸 출력이다. server 는 같은 파일로 저장→히스토리 왕복을 본다.
 * 계약이 바뀌면 원본을 그대로 다시 복사한다 — 손으로 고치지 않는다.
 */
type Example = { tool: string; card: unknown; summary: string };

/** 예시 카드가 실어 보낸 사람 말 전부. 하나라도 화면에서 빠지면 무엇을 승인하는지 잘못 읽는다. */
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
  it("승인을 묻는 도구 23종이 전부 있다", () => {
    expect((examples as Example[]).map((each) => each.tool)).toHaveLength(23);
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
      // 접힌 항목·본문도 DOM 에는 있다 — `details` 는 닫혀도 내용을 지우지 않는다.
      const text = (container.textContent ?? "").replace(/\s+/g, " ");
      for (const word of wordsOf(example.card as Record<string, unknown>)) {
        expect(text).toContain(word.replace(/\s+/g, " "));
      }
      expect(text).not.toContain(tool);
      // 평문으로만 그린다 — 링크도 강조 태그도 생기지 않는다.
      expect(container.querySelector("a, strong, em, b")).toBeNull();
    }
  );
});
