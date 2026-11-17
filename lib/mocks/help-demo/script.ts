type ScriptLine = { label: string; text: string };

export type ParsedScript = {
  lines: ScriptLine[];
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

export function anchorsOf(script: ParsedScript) {
  return (...names: string[]) =>
    names.map((name) => {
      const at = script.anchors[name];
      if (at === undefined) throw new Error(`help-demo 없는 표식: ${name}`);
      return at;
    });
}
