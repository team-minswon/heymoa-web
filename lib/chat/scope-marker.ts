import { type ScopeChip, scopeKey } from "@/lib/chat/scope-chip";

/**
 * 문장 안에서 범위를 가리키는 **마커**.
 *
 * ```
 * @[주간 회의](noteId:0HZX2K7M9Q4AF) 액션 정리해줘
 * ```
 *
 * 키 이름은 계약 필드 `noteIds` · `projectIds` 의 **단수와 정확히 같다**. 다르면 읽는
 * 쪽이 둘을 헷갈린다.
 *
 * ### 배열을 대신하지 않는다
 *
 * 범위는 계속 `noteIds` · `projectIds` 배열이 쥔다 — 서버가 멤버십으로 거르는 입력이다.
 * 마커는 브라우저가 문장에 박아 보낸 글자라 위조가 쉽고, **「문장의 이 자리가 그중
 * 무엇을 가리키나」만** 말한다. 둘이 어긋나면 배열이 이긴다.
 *
 * ### 이스케이프 — 라벨의 `\` 와 `]` 둘뿐이다
 *
 * 「알림 정책 논의 (2차)」처럼 **괄호가 든 제목이 실제로 있다.** 그런데 제목은 `[…]`
 * 안에만 들어가고 `(…)` 안은 `키:id` 뿐이라, 제목의 `)` 는 괄호를 못 닫는다 — 뺄 필요가
 * 없다. 라벨을 끊을 수 있는 것은 `]` 하나이고, 그것을 빼려면 `\` 자신도 빼야 한다.
 *
 * **규칙을 둘로 좁힌 이유** — 이 규칙을 server(Kotlin)와 ai(프롬프트)가 각자 다시 짠다.
 * 규칙이 늘수록 세 곳이 어긋날 자리가 는다.
 */
const KEY: Record<ScopeChip["kind"], string> = {
  note: "noteId",
  project: "projectId",
};

/**
 * id 를 13자로 안 묶는다. 목과 검사가 `n1` 같은 짧은 id 를 쓰고, **경계는 어차피 배열이
 * 쥐므로** 여기서 길이를 재 봐야 얻는 것이 없다.
 */
const MARKER =
  /@\[((?:[^\]\\]|\\.)*)\]\((noteId|projectId):([A-Za-z0-9_-]+)\)/g;

export function scopeMarker(chip: ScopeChip) {
  return `@[${chip.title.replace(/[\\\]]/g, "\\$&")}](${KEY[chip.kind]}:${chip.id})`;
}

export type MarkerPart =
  | { text: string }
  | { kind: ScopeChip["kind"]; id: string; title: string; raw: string };

/**
 * 문장을 글자와 마커로 쪼갠다. 마커가 하나도 없으면 **빈 배열**이다 — 부르는 쪽이
 * 「옛 메시지」로 갈라 갈 수 있어야 한다.
 *
 * ★ **배열이 이긴다.** `allowed`(그 메시지의 `scope[]`에서 만든 키 집합)에 없는 id 를
 * 가리키는 마커는 **칩으로 안 그리고 글자 그대로 남긴다.** 없는 것을 있는 것처럼
 * 그리는 쪽이 나쁘다 — 눌러도 갈 곳이 없는 칩이 선다.
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
    // 배열 밖이면 마커가 아니라 글자다. `last`를 안 옮겨 뒤 글자에 그대로 섞인다.
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

/**
 * 마커를 사람 말로 되돌린다. `keep` 을 주면 **그 id 를 가리키는 마커만 남긴다.**
 *
 * 「범위 넓히기」가 앞 턴의 문장을 새 범위로 다시 보낼 때 필요하다 — 안 풀면 새 배열에
 * 없는 id 를 가리키는 마커가 그대로 나가서, 말풍선에는 날글자로 뜨고 모델은 범위 밖을
 * 가리키는 표를 읽는다.
 */
export function unwrapScopeMarkers(content: string, keep?: Set<string>) {
  return content.replace(MARKER, (raw, label: string, _key, id: string) =>
    keep?.has(id) ? raw : unescapeLabel(label)
  );
}

/**
 * ★ **칩으로 되돌릴 마커는 글자까지 지운다.**
 *
 * `unwrapScopeMarkers` 는 마커를 **제목 글자로** 되돌린다 — 칩을 다시 안 박는 자리(범위
 * 넓히기)에서는 그게 맞다. 그런데 못 보낸 문장을 컴포저로 되돌릴 때는 **칩도 같이 다시
 * 박으므로**, 풀어 두면 같은 이름이 **칩 한 벌 + 날글자 한 벌**로 두 번 앉고 그대로 다시
 * 보내면 문장이 「@[주간 회의](…) 주간 회의 정리해줘」가 된다.
 *
 * 칩이 될 id 의 마커만 지우고 나머지는 사람 말로 되돌린다 — 그것들은 칩이 안 되므로
 * 글자로 남아야 한다.
 */
export function dropScopeMarkers(content: string, ids: Set<string>) {
  return (
    content
      .replace(MARKER, (raw, label: string, _key, id: string) =>
        ids.has(id) ? "" : unescapeLabel(label)
      )
      // 지운 자리에 남는 겹공백을 접는다. 안 접으면 다시 보낸 문장 앞에 공백이 붙는다.
      .replace(/\s{2,}/g, " ")
      .trim()
  );
}

function unescapeLabel(label: string) {
  return label.replace(/\\(.)/g, "$1");
}
