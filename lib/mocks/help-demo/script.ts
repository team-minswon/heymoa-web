/**
 * 대사 문자열을 발화 목록으로 푸는 도구. 한 줄이 한 발화다.
 *
 * ```
 * A 네, 시작할게요.
 * B 좋아요. @opening
 * ```
 *
 * 첫 낱말이 화자 라벨(A~F), 나머지가 본문이다. 줄 끝의 `@이름` 은 그 발화에 붙이는 **표식**이라
 * 본문에서는 떨어진다 — 검토본의 근거 인용이 발화 순번을 손으로 세지 않고 표식으로 가리킨다.
 */
export type ScriptLine = { label: string; text: string };

export type ParsedScript = {
  lines: ScriptLine[];
  /** 표식 이름 → 발화 순번(0부터) */
  anchors: Record<string, number>;
};

export function parseScript(source: string): ParsedScript {
  const lines: ScriptLine[] = [];
  const anchors: Record<string, number> = {};
  for (const raw of source.split("\n")) {
    const row = raw.trim();
    if (!row) continue;
    const match = row.match(/^([A-F])\s+(.+?)(?:\s+@([a-z0-9-]+))?$/);
    if (!match) throw new Error(`help-demo 대사 형식 오류: ${row}`);
    const [, label, text, anchor] = match;
    if (anchor) {
      if (anchor in anchors) throw new Error(`help-demo 표식 중복: ${anchor}`);
      anchors[anchor] = lines.length;
    }
    lines.push({ label, text });
  }
  return { lines, anchors };
}

/** 표식 이름을 순번으로. 없는 이름이면 바로 터뜨려 오타가 조용히 NaN 이 되지 않게 한다. */
export function anchorsOf(script: ParsedScript) {
  return (...names: string[]) =>
    names.map((name) => {
      const at = script.anchors[name];
      if (at === undefined) throw new Error(`help-demo 없는 표식: ${name}`);
      return at;
    });
}
