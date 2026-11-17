import { isValidElement, type ReactNode } from "react";

export function textOf(node: ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (isValidElement<{ children?: ReactNode }>(node)) {
    const own = (node.type as { text?: (props: never) => string }).text;
    return typeof own === "function"
      ? own(node.props as never)
      : textOf(node.props.children);
  }
  return "";
}
