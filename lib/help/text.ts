import { isValidElement, type ReactNode } from "react";

/** 본문 노드의 글자만 뽑는다(링크·강조 속 글자 포함). 검색 색인과 JSON-LD 가 같은 글을 쓰게 한다. */
export function textOf(node: ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (isValidElement<{ children?: ReactNode }>(node)) {
    // 글이 children 이 아닌 props 에 있는 컴포넌트(`MdBlock` · `FaqItem`)는 정적 `text` 로 자기 글을 낸다
    const own = (node.type as { text?: (props: never) => string }).text;
    return typeof own === "function"
      ? own(node.props as never)
      : textOf(node.props.children);
  }
  return "";
}
