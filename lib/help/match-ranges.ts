/**
 * 사용 가이드 검색 (APP-1232). DOM 을 바꾸지 않고 본문 텍스트 노드를 훑어 일치 구간을 `Range` 로 돌려준다.
 *
 * 공백·대소문자를 무시한 부분 문자열 일치다(한국어는 조사·어미가 붙어 낱말 단위로는 못 찾는다). 강조(`<b>`)·링크(`<a>`)
 * 같은 중첩 노드를 가로지르는 일치도 잡히고, 문단(블록)을 가로지르는 일치는 만들지 않는다.
 */

const BLOCK = "p,h1,h2,h3,li,div,section,article,dd,dt";
const SEPARATOR = "\u0000";

/** 공백을 모두 빼고 소문자로 맞춘다. */
export const normalizeQuery = (value: string) =>
  value.replace(/[\s\u0000]+/g, "").toLowerCase();

type Slot = { node: Text; offset: number };

/** 본문의 일치 구간. 검색어가 비면 빈 배열이다. */
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
      // 소문자로 바꾸면 길이가 달라지는 글자(İ 등)는 첫 글자만 쓴다.
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

/** 이전/다음 이동. 처음과 끝은 이어진다. */
export const stepIndex = (current: number, total: number, direction: 1 | -1) =>
  total === 0 ? -1 : (current + direction + total) % total;
