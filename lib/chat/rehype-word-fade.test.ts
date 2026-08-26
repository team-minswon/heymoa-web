import { describe, expect, it } from "vitest";

import { rehypeWordFade } from "@/lib/chat/rehype-word-fade";

type Node = { type: string; tagName?: string; value?: string; children?: Node[] };

const text = (value: string): Node => ({ type: "text", value });
const el = (tagName: string, children: Node[]): Node => ({
  type: "element",
  tagName,
  children,
});
const run = (tree: Node) => {
  rehypeWordFade()(tree as never);
  return tree;
};

describe("rehypeWordFade", () => {
  it("낱말마다 요소를 세우고 공백은 그대로 둔다", () => {
    // 공백을 요소로 감싸면 줄바꿈이 죽는다.
    const tree = run(el("p", [text("금요일 오후 6시")]));
    expect(tree.children?.map((c) => c.tagName ?? c.value)).toEqual([
      "span",
      " ",
      "span",
      " ",
      "span",
    ]);
  });

  it("낱말 span 에 표식을 단다", () => {
    const tree = run(el("p", [text("안녕")]));
    const span = tree.children?.[0] as { properties?: { className?: string[] } };
    expect(span.properties?.className).toEqual(["md-w"]);
  });

  it("code·pre 안은 안 건드린다", () => {
    // 공백이 의미라서 쪼개면 코드가 깨진다.
    const tree = run(el("pre", [el("code", [text("const a = 1")])]));
    const code = tree.children?.[0];
    expect(code?.children).toEqual([{ type: "text", value: "const a = 1" }]);
  });

  it("중첩된 서식 안까지 들어간다", () => {
    const tree = run(el("p", [el("strong", [text("두 낱말")])]));
    const strong = tree.children?.[0];
    expect(strong?.children?.filter((c) => c.type === "element")).toHaveLength(2);
  });

  it("빈 조각은 남기지 않는다", () => {
    // split 이 앞뒤로 빈 문자열을 낸다. 남기면 빈 text 노드가 쌓인다.
    const tree = run(el("p", [text(" 하나 ")]));
    expect(tree.children?.every((c) => c.value !== "")).toBe(true);
  });
});
