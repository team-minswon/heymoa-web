/**
 * 가이드 마크다운 문법을 화면 컴포넌트 이름(hast 태그)으로 옮기는 remark 플러그인.
 * 문법표와 예시는 `content/help/README.md` 에 있다. 새 문법을 더하면 거기도 고친다.
 *
 * - `> [!참고]` 같은 알림 → `help-callout`
 * - `==핵심==` → `mark`
 * - `::::tabs` / `:::tab{title="Mac"}` → `help-tabs` / `help-tab`
 * - `:::problem` → `help-problem` (증상 / 원인 / 해결 방법)
 * - `::clip{name="…" alt="…" caption="…"}` → `help-clip`
 * - `:badge[관리자만]` → `help-badge`
 * - 모르는 `:이름` 은 글자 그대로 되돌린다(예: 시각 `HH:MM`).
 */
type Node = {
  type: string;
  value?: string;
  name?: string;
  attributes?: Record<string, string | null | undefined> | null;
  children?: Node[];
  data?: { hName?: string; hProperties?: Record<string, unknown> };
};

export const CALLOUT_KINDS = ["참고", "팁", "주의", "되돌릴 수 없어요"] as const;

const containerNames = { tabs: "help-tabs", tab: "help-tab", problem: "help-problem" } as const;

function walk(node: Node, fn: (n: Node, parent: Node | null, index: number) => void, parent: Node | null = null, index = 0) {
  fn(node, parent, index);
  // fn 이 자식을 바꿀 수 있어 매번 길이를 다시 읽는다
  for (let i = 0; node.children && i < node.children.length; i += 1) {
    walk(node.children[i], fn, node, i);
  }
}

const MARK = /==([^=\n][^\n]*?)==/g;

/**
 * `**[새 노트]** 를` 의 띄어쓰기. 마크다운은 `]**를` 처럼 붙이면 굵게가 풀려서 원문은 띄워 쓴다.
 * 굵은 글 바로 뒤 낱말이 조사로만 이뤄졌으면 앞 공백을 지워 「[새 노트]를」로 붙인다(줄 머리에 조사만 넘어가지 않게).
 */
const PARTICLE = /^ (?:으로|에서|에게|까지|부터|처럼|보다|이나|이라|이에요|예요|이요|은|는|이|가|을|를|도|만|의|에|로|와|과|나|라|요)+(?=[^가-힣]|$)/;

export function remarkHelp() {
  return (tree: Node) => {
    walk(tree, (node, parent, index) => {
      if (node.type === "text" && index > 0 && parent?.children?.[index - 1]?.type === "strong" && PARTICLE.test(node.value ?? "")) {
        node.value = (node.value ?? "").slice(1);
      }

      // ==핵심 문구==
      if (node.type === "text" && node.value?.includes("==") && parent?.children) {
        const parts: Node[] = [];
        let last = 0;
        for (const m of node.value.matchAll(MARK)) {
          if (m.index > last) parts.push({ type: "text", value: node.value.slice(last, m.index) });
          parts.push({
            type: "mark",
            data: { hName: "mark" },
            children: [{ type: "text", value: m[1] }],
          });
          last = m.index + m[0].length;
        }
        if (parts.length > 0) {
          if (last < node.value.length) parts.push({ type: "text", value: node.value.slice(last) });
          parent.children.splice(index, 1, ...parts);
        }
        return;
      }

      // > [!참고] 알림
      if (node.type === "blockquote") {
        const first = node.children?.[0];
        const text = first?.type === "paragraph" ? first.children?.[0] : undefined;
        const hit = text?.type === "text" ? /^\[!([^\]]+)\]\s*/.exec(text.value ?? "") : null;
        if (hit && text) {
          text.value = (text.value ?? "").slice(hit[0].length);
          node.data = { hName: "help-callout", hProperties: { kind: hit[1] } };
        }
        return;
      }

      if (node.type === "containerDirective" && node.name && node.name in containerNames) {
        node.data = {
          hName: containerNames[node.name as keyof typeof containerNames],
          hProperties: node.name === "tab" ? { title: node.attributes?.title ?? "" } : {},
        };
        return;
      }
      if (node.type === "leafDirective" && node.name === "clip") {
        node.data = { hName: "help-clip", hProperties: { ...node.attributes } };
        node.children = [];
        return;
      }
      if (node.type === "textDirective" && node.name === "badge") {
        node.data = { hName: "help-badge", hProperties: {} };
        return;
      }
      // 모르는 지시문은 글자 그대로
      if (
        (node.type === "textDirective" || node.type === "leafDirective" || node.type === "containerDirective") &&
        parent?.children
      ) {
        const prefix = node.type === "textDirective" ? ":" : node.type === "leafDirective" ? "::" : ":::";
        parent.children.splice(
          index,
          1,
          { type: "text", value: `${prefix}${node.name ?? ""}` },
          ...(node.children ?? [])
        );
      }
    });
  };
}
