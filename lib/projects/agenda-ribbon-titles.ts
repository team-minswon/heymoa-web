import type { MapAgenda } from "@/lib/projects/agenda-map";

export const OPEN_MIN = 320;
export const OPEN_MAX = 760;
const OPEN_SHARE = 0.7;
export const OPEN_FLOOR = 280;
const OPEN_DOT_AT = 0.25;
const GAP = 38;
const RIGHT = 24;
const MORE = 28;
const ZONE_SIDE = 89;
const SLACK = 1.05;

type TitleWidth = (text: string) => number;

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

export function makeMeasure(font: string): TitleWidth | null {
  if (typeof document === "undefined") return null;
  const context = document.createElement("canvas").getContext("2d");
  if (!context) return null;
  context.font = font;
  return (text) => context.measureText(text).width;
}

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

export function openCap(visible: number, panel: number, panelShown: boolean) {
  if (panelShown) return Math.max(OPEN_FLOOR, OPEN_SHARE * (visible - panel));
  return Math.max(OPEN_FLOOR, Math.min(OPEN_MAX, visible * 0.92));
}

export function openWidth(need: number, cap: number) {
  return Math.min(Math.max(need, OPEN_MIN), cap);
}
