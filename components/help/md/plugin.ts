type Node = {
  type: string;
  value?: string;
  name?: string;
  attributes?: Record<string, string | null | undefined> | null;
  children?: Node[];
  data?: { hName?: string; hProperties?: Record<string, unknown> };
};

const containerNames = { tabs: "help-tabs", tab: "help-tab", problem: "help-problem" } as const;

function walk(node: Node, fn: (n: Node, parent: Node | null, index: number) => void, parent: Node | null = null, index = 0) {
  fn(node, parent, index);
  for (let i = 0; node.children && i < node.children.length; i += 1) {
    walk(node.children[i], fn, node, i);
  }
}

const MARK = /==([^=\n][^\n]*?)==/g;

const PARTICLE = /^ (?:으로|에서|에게|까지|부터|처럼|보다|이나|이라|이에요|예요|이요|은|는|이|가|을|를|도|만|의|에|로|와|과|나|라|요)+(?=[^가-힣]|$)/;

export function remarkHelp() {
  return (tree: Node) => {
    walk(tree, (node, parent, index) => {
      if (node.type === "text" && index > 0 && parent?.children?.[index - 1]?.type === "strong" && PARTICLE.test(node.value ?? "")) {
        node.value = (node.value ?? "").slice(1);
      }

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
