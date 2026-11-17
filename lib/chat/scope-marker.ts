import { type ScopeChip, scopeKey } from "@/lib/chat/scope-chip";

/** 이스케이프는 라벨의 `\` 와 `]` 둘뿐입니다. 같은 규칙을 server 와 ai 가 각자 짜므로 늘리지 않습니다. */
const KEY: Record<ScopeChip["kind"], string> = {
  note: "noteId",
  project: "projectId",
};

const MARKER =
  /@\[((?:[^\]\\]|\\.)*)\]\((noteId|projectId):([A-Za-z0-9_-]+)\)/g;

export function scopeMarker(chip: ScopeChip) {
  return `@[${chip.title.replace(/[\\\]]/g, "\\$&")}](${KEY[chip.kind]}:${chip.id})`;
}

export type MarkerPart =
  | { text: string }
  | { kind: ScopeChip["kind"]; id: string; title: string; raw: string };

export function splitScopeMarkers(
  content: string,
  allowed: ReadonlySet<string>
): MarkerPart[] {
  const parts: MarkerPart[] = [];
  let last = 0;
  for (const match of content.matchAll(MARKER)) {
    const kind = match[2] === "projectId" ? "project" : "note";
    const id = match[3];
    if (!allowed.has(scopeKey({ kind, id }))) continue;
    const at = match.index;
    if (at > last) parts.push({ text: content.slice(last, at) });
    parts.push({ kind, id, title: unescapeLabel(match[1]), raw: match[0] });
    last = at + match[0].length;
  }
  if (parts.length === 0) return [];
  if (last < content.length) parts.push({ text: content.slice(last) });
  return parts;
}

export function unwrapScopeMarkers(content: string, keep?: Set<string>) {
  return content.replace(MARKER, (raw, label: string, _key, id: string) =>
    keep?.has(id) ? raw : unescapeLabel(label)
  );
}

export function dropScopeMarkers(content: string, ids: Set<string>) {
  return content
    .replace(MARKER, (raw, label: string, _key, id: string) =>
      ids.has(id) ? "" : unescapeLabel(label)
    )
    .replace(/\s{2,}/g, " ")
    .trim();
}

function unescapeLabel(label: string) {
  return label.replace(/\\(.)/g, "$1");
}
