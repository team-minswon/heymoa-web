/**
 * 공유 카드(satori)는 글자 폭을 재 주지 않고 `text-wrap: balance` 도 모른다. 한국어가 낱말 중간에서 끊기거나
 * 한 줄에 한두 글자만 남지 않도록, 어절 단위로 폭을 어림해 줄을 직접 나눈다. 글자 폭은 근사값이라
 * 판 안쪽 폭(`maxWidth`)에 여유를 두고 쓴다.
 */
const glyphWidth = (ch: string) => {
  if (ch === " ") return 0.3;
  if (/[가-힣ㄱ-ㅎ一-鿿]/.test(ch)) return 1;
  if (/[A-Z0-9]/.test(ch)) return 0.65;
  if (/[a-z]/.test(ch)) return 0.55;
  return 0.4; // 문장부호 · 가운뎃점 등
};

export const textWidth = (text: string, fontSize: number, letterSpacing = 0) =>
  [...text].reduce(
    (sum, ch) => sum + glyphWidth(ch) * fontSize + letterSpacing,
    0
  );

/** 어절 사이에서만 끊고, 가장 긴 줄이 가장 짧아지는 나눔을 고른다(그래서 마지막 줄이 한두 글자로 남지 않는다). */
export function balancedLines(
  text: string,
  fontSize: number,
  maxWidth: number,
  letterSpacing = 0
): string[] {
  const words = text.split(" ").filter(Boolean);
  const w = (from: number, to: number) =>
    textWidth(words.slice(from, to).join(" "), fontSize, letterSpacing);
  // best[i][k]: words[i..] 를 k 줄로 나눌 때 가장 긴 줄의 최소 폭
  const n = words.length;
  for (let lines = 1; lines <= n; lines++) {
    const memo = new Map<string, [number, number[]]>();
    const solve = (i: number, k: number): [number, number[]] => {
      const key = `${i},${k}`;
      const hit = memo.get(key);
      if (hit) return hit;
      let res: [number, number[]];
      if (k === 1) res = [w(i, n), [n]];
      else {
        res = [Infinity, []];
        for (let j = i + 1; j <= n - (k - 1); j++) {
          const [rest, cuts] = solve(j, k - 1);
          const width = Math.max(w(i, j), rest);
          if (width < res[0]) res = [width, [j, ...cuts]];
        }
      }
      memo.set(key, res);
      return res;
    };
    const [width, cuts] = solve(0, lines);
    if (width <= maxWidth || lines === n) {
      const out: string[] = [];
      let from = 0;
      for (const to of cuts) {
        out.push(words.slice(from, to).join(" "));
        from = to;
      }
      return out;
    }
  }
  return [text];
}

/** 최대 `maxLines` 줄. 넘치면 마지막 줄을 어절 단위로 줄이고 「…」를 붙인다. */
export function clampedLines(
  text: string,
  fontSize: number,
  maxWidth: number,
  maxLines: number
): string[] {
  const lines = balancedLines(text, fontSize, maxWidth);
  if (lines.length <= maxLines) return lines;
  // 넘치면 앞 줄들을 그대로 두고 남은 말을 마지막 줄에 담아 자른다.
  const head = lines.slice(0, maxLines - 1);
  const words = lines
    .slice(maxLines - 1)
    .join(" ")
    .split(" ");
  let last = "";
  for (const word of words) {
    const next = last ? `${last} ${word}` : word;
    if (textWidth(`${next}…`, fontSize) > maxWidth) break;
    last = next;
  }
  return [...head, `${(last || words[0]).replace(/[,.·]+$/, "")}…`];
}

/** 큰 글자부터 시도해 2줄 안에 드는 첫 크기. 모두 넘치면 가장 작은 크기(3줄까지). */
export function fitTitle(
  title: string,
  maxWidth: number,
  sizes: readonly number[],
  letterSpacingEm: number
) {
  for (const size of sizes) {
    const lines = balancedLines(title, size, maxWidth, size * letterSpacingEm);
    if (lines.length <= 2) return { size, lines };
  }
  const size = sizes[sizes.length - 1];
  return {
    size,
    lines: balancedLines(title, size, maxWidth, size * letterSpacingEm),
  };
}
