const BLOCK = "p,h1,h2,h3,li,div,section,article,dd,dt";
const SEPARATOR = "\u0000";

export const normalizeQuery = (value: string) =>
  value.replace(/[\s\u0000]+/g, "").toLowerCase();

type Slot = { node: Text; offset: number };

export function findMatchRanges(root: Element, query: string): Range[] {
  const needle = normalizeQuery(query);
  if (!needle) return [];

  const doc = root.ownerDocument;
  let haystack = "";
  const slots: (Slot | null)[] = [];
  let lastBlock: Element | null = null;

  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node as Text;
    const block = text.parentElement?.closest(BLOCK) ?? null;
    if (block !== lastBlock) {
      haystack += SEPARATOR;
      slots.push(null);
      lastBlock = block;
    }
    const value = text.data;
    for (let i = 0; i < value.length; i += 1) {
      if (/\s/.test(value[i])) continue;
      const lower = value[i].toLowerCase();
      // 소문자로 바꾸면 길이가 달라지는 글자(İ 등)는 첫 글자만 씁니다.
      haystack += lower[0];
      slots.push({ node: text, offset: i });
    }
  }

  const ranges: Range[] = [];
  for (
    let from = haystack.indexOf(needle);
    from !== -1;
    from = haystack.indexOf(needle, from + needle.length)
  ) {
    const start = slots[from];
    const end = slots[from + needle.length - 1];
    if (!start || !end) continue;
    const range = doc.createRange();
    range.setStart(start.node, start.offset);
    range.setEnd(end.node, end.offset + 1);
    ranges.push(range);
  }
  return ranges;
}

export const stepIndex = (current: number, total: number, direction: 1 | -1) =>
  total === 0 ? -1 : (current + direction + total) % total;
