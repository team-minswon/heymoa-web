/**
 * 마크다운의 글자를 **낱말 단위 `<span>`으로 쪼갠다.**
 *
 * 스트리밍이 투박해 보이는 이유는 글자가 한 톨씩 툭 나타나서다. 낱말이 저마다
 * 흐릿하게 떠오르면 스르륵 흐르는 것처럼 읽힌다.
 *
 * ### 왜 리듀서가 아니라 여기인가
 *
 * 토큰이 올 때마다 마크다운은 **전체를 다시 그린다.** 그래서 "방금 붙은 조각"을
 * DOM 에서 잡을 수가 없다. 대신 낱말을 각자의 요소로 만들어 두면 React 가 위치로
 * 짝을 맞추므로, **이미 있던 낱말은 그 DOM 을 그대로 쓰고 새로 붙은 낱말만 마운트**된다.
 * CSS 애니메이션은 마운트에만 걸리니 새 낱말만 떠오른다.
 *
 * 마지막 낱말은 글자가 늘면서 같은 요소를 유지한다 — 한 번 떠오른 뒤 제자리에서
 * 자란다. 이게 오히려 자연스럽다.
 *
 * ### 안 쪼개는 곳
 *
 * `code`·`pre` 는 공백이 의미라서 건드리면 코드가 깨진다.
 */

type HastText = { type: "text"; value: string };
type HastElement = {
  type: "element";
  tagName: string;
  properties?: Record<string, unknown>;
  children: HastNode[];
};
type HastNode = HastText | HastElement | { type: string; children?: HastNode[] };

const KEEP_WHITESPACE = new Set(["code", "pre"]);

/** 낱말과 그 사이 공백을 번갈아 남긴다. 공백은 그대로 둬야 줄바꿈이 산다. */
function splitWords(value: string): HastNode[] {
  return value.split(/(\s+)/).flatMap<HastNode>((piece) => {
    if (piece === "") return [];
    if (/^\s+$/.test(piece)) return [{ type: "text", value: piece }];
    return [
      {
        type: "element",
        tagName: "span",
        properties: { className: ["md-w"] },
        children: [{ type: "text", value: piece }],
      },
    ];
  });
}

function walk(node: HastNode) {
  const children = (node as HastElement).children;
  if (!Array.isArray(children)) return;
  if (
    node.type === "element" &&
    KEEP_WHITESPACE.has((node as HastElement).tagName)
  ) {
    return;
  }
  (node as HastElement).children = children.flatMap((child) => {
    if (child.type === "text") return splitWords((child as HastText).value);
    walk(child);
    return [child];
  });
}

export function rehypeWordFade() {
  return (tree: HastNode) => walk(tree);
}
