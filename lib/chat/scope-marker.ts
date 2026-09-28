import { type ScopeChip, scopeKey } from "@/lib/chat/scope-chip";

/**
 * 문장 안에서 범위를 가리키는 마커. `@[주간 회의](noteId:0HZX2K7M9Q4AF) 액션 정리해줘`.
 * 키 이름은 계약 필드 `noteIds`·`projectIds` 의 단수와 같다.
 *
 * 범위는 여전히 배열이 쥔다(서버가 멤버십으로 거르는 입력). 마커는 위조가 쉬운 글자라
 * 「문장의 이 자리가 그중 무엇인가」만 말하고, 어긋나면 배열이 이긴다.
 *
 * 이스케이프는 라벨의 `\` 와 `]` 둘뿐이다. `(…)` 안은 `키:id` 뿐이라 제목의 `)` 는 괄호를
 * 못 닫는다. 같은 규칙을 server 와 ai 가 각자 짜므로 규칙을 늘리지 않는다.
 */
const KEY: Record<ScopeChip["kind"], string> = {
  note: "noteId",
  project: "projectId",
};

// id 길이는 안 잰다. 목·검사는 `n1` 같은 짧은 id 를 쓰고, 경계는 어차피 배열이 쥔다.
const MARKER =
  /@\[((?:[^\]\\]|\\.)*)\]\((noteId|projectId):([A-Za-z0-9_-]+)\)/g;

export function scopeMarker(chip: ScopeChip) {
  return `@[${chip.title.replace(/[\\\]]/g, "\\$&")}](${KEY[chip.kind]}:${chip.id})`;
}

export type MarkerPart =
  | { text: string }
  | { kind: ScopeChip["kind"]; id: string; title: string; raw: string };

/**
 * 문장을 글자와 마커로 쪼갠다. 마커가 없으면 빈 배열이라 부르는 쪽이 옛 메시지로 갈라 간다.
 * `allowed`(그 메시지의 `scope[]` 키)에 없는 마커는 칩이 아니라 글자로 남긴다 — 눌러도 갈
 * 곳이 없는 칩을 세우지 않는다.
 */
export function splitScopeMarkers(
  content: string,
  allowed: ReadonlySet<string>
): MarkerPart[] {
  const parts: MarkerPart[] = [];
  let last = 0;
  for (const match of content.matchAll(MARKER)) {
    const kind = match[2] === "projectId" ? "project" : "note";
    const id = match[3];
    // 배열 밖이면 글자다. `last` 를 안 옮겨 뒤 글자에 섞인다.
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

/** 마커를 제목 글자로 되돌린다. `keep` 에 든 id 의 마커는 남긴다. */
export function unwrapScopeMarkers(content: string, keep?: Set<string>) {
  return content.replace(MARKER, (raw, label: string, _key, id: string) =>
    keep?.has(id) ? raw : unescapeLabel(label)
  );
}

/**
 * 칩으로 다시 박을 id 의 마커는 글자까지 지우고 나머지는 제목으로 되돌린다. 못 보낸 문장을
 * 컴포저로 되돌리며 칩도 다시 박으므로, 풀어 두면 같은 이름이 칩과 글자로 두 번 앉는다.
 */
export function dropScopeMarkers(content: string, ids: Set<string>) {
  return (
    content
      .replace(MARKER, (raw, label: string, _key, id: string) =>
        ids.has(id) ? "" : unescapeLabel(label)
      )
      // 지운 자리의 겹공백을 접는다.
      .replace(/\s{2,}/g, " ")
      .trim()
  );
}

function unescapeLabel(label: string) {
  return label.replace(/\\(.)/g, "$1");
}
