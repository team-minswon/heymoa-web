import type { MapAgenda } from "@/lib/projects/agenda-map";

/**
 * 펼친 열의 폭. 안건 제목은 점 오른쪽에 **한 줄**로 서고(줄바꿈·행 높이 늘림 없음) 그 열 안 가장 긴 제목이 다 보이게 열이 넓어진다.
 * 점은 열 폭의 25% 지점이라 제목은 그 오른쪽 75% 에서 점·간격(38px: 굵은 막대 끝 22 + 8 + 글자 앞 여유)과 오른쪽 여백(24px)을 뺀 만큼 쓴다: `W = (가장 긴 제목의 한 줄 폭 + 「외 N」 + 62px) / 0.75`.
 * 글자 폭은 글꼴로 한 번 재서(`makeMeasure`) 판이 쥐고 있고, 렌더 중에는 DOM 을 읽지 않는다.
 */

/** 눌러서 펼친 열의 최소 폭과, 판이 닫혀 있을 때의 최대 폭(좁은 화면에서는 판 폭의 92% 까지만) */
export const OPEN_MIN = 320;
export const OPEN_MAX = 760;
/** 패널이 열려 판이 좁을 때는 보이는 판 폭의 70% 까지. 패널이 열려도 이보다 좁아지지는 않는다 */
export const OPEN_SHARE = 0.7;
export const OPEN_FLOOR = 280;
/** 펼친 열의 점은 열 폭의 25% 지점. 점 가운데에서 제목 글자까지(캡슐 반폭 + 8px)와 열 오른쪽 여유, 「외 N」 */
export const OPEN_DOT_AT = 0.25;
const GAP = 38;
const RIGHT = 24;
const MORE = 28;
/** 열 아래 「그 밖의 안건」 한 줄: 네모 표식(12) + 간격 + 왼쪽 들여쓰기(19) + 「갈래」 배지와 오른쪽 여유 */
const ZONE_SIDE = 89;
/** 굵은 글씨(고른 안건)와 반올림으로 늘어나는 폭 */
const SLACK = 1.05;

export type TitleWidth = (text: string) => number;

/** 글꼴을 못 쟀을 때(서버·테스트)의 어림: 한글·한자 1em, 숫자·영문 0.58em, 공백 0.3em, 그 밖 0.5em */
export function estimateWidth(text: string, size: number) {
  let sum = 0;
  for (const char of text) {
    if (/[ᄀ-ᇿ㄰-㆏가-힯一-鿿぀-ヿ＀-￯]/.test(char)) sum += size;
    else if (/[0-9A-Za-z]/.test(char)) sum += size * 0.58;
    else if (char === " ") sum += size * 0.3;
    else sum += size * 0.5;
  }
  return sum;
}

/** 캔버스로 글꼴(`font`: CSS 단축 표기) 그대로 잰다. 캔버스를 못 얻으면 null */
export function makeMeasure(font: string): TitleWidth | null {
  if (typeof document === "undefined") return null;
  const context = document.createElement("canvas").getContext("2d");
  if (!context) return null;
  context.font = font;
  return (text) => context.measureText(text).width;
}

/** 열 하나의 펼침 폭(제한 전): 점 오른쪽 제목들과 아래 「그 밖의 안건」 한 줄이 다 들어가는 폭 */
export function openNeed(stops: ReadonlyArray<{ agendas: readonly Pick<MapAgenda, "title">[] }>, zone: readonly Pick<MapAgenda, "title">[], measure: TitleWidth) {
  let title = 0;
  for (const stop of stops) {
    const more = stop.agendas.length > 1 ? MORE : 0;
    for (const agenda of stop.agendas) title = Math.max(title, measure(agenda.title) * SLACK + more);
  }
  let extra = 0;
  for (const agenda of zone) extra = Math.max(extra, measure(agenda.title) * SLACK + ZONE_SIDE);
  return Math.ceil(Math.max(title > 0 ? (title + GAP + RIGHT) / (1 - OPEN_DOT_AT) : 0, extra));
}

/** 이 판에서 펼친 열 하나가 가질 수 있는 가장 큰 폭. `visible` 은 패널이 닫혔을 때 보이는 판 폭, `panel` 은 패널이 차지하는 폭(간격 포함) */
export function openCap(visible: number, panel: number, panelShown: boolean) {
  if (panelShown) return Math.max(OPEN_FLOOR, OPEN_SHARE * (visible - panel));
  return Math.max(OPEN_FLOOR, Math.min(OPEN_MAX, visible * 0.92));
}

/** 펼침 폭: 필요한 폭을 최소·최대 안으로 */
export function openWidth(need: number, cap: number) {
  return Math.min(Math.max(need, OPEN_MIN), cap);
}
