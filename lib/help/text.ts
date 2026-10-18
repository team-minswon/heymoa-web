import { isValidElement, type ReactNode } from "react";

/** 본문 노드의 글자만 뽑는다(링크·강조 속 글자 포함). 검색 색인과 JSON-LD 가 같은 글을 쓰게 한다. */
export function textOf(node: ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (isValidElement<{ children?: ReactNode }>(node))
    return textOf(node.props.children);
  return "";
}
