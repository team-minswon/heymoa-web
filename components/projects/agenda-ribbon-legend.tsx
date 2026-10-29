"use client";

import { FoldPill, JoinMark, NORMAL, StopGlyph, THIN, forkPath, stopMetrics } from "@/components/projects/agenda-ribbon-column";
import { Badge } from "@/components/ui/badge";

/** 이 판에 실제로 있는 것만 범례에 올린다 */
export type LegendHas = { capsule: boolean; gap: boolean; branch: boolean; fold: boolean; join: boolean };

/** 범례의 기호는 판에서 가장 흔한 넓은 열의 모양으로 그린다 */
const COL = 40;

/** 굵은 노선 조각 위에 점이 앉은 기호 하나(판의 안건 점과 같은 컴포넌트) */
function Rail({ children }: { children: React.ReactNode }) {
  return (
    <span aria-hidden className="relative flex h-6 w-[34px] shrink-0 items-center justify-center">
      <span className="absolute inset-x-0 h-[6px] rounded-full" style={{ background: NORMAL.ribbon }} />
      {children}
    </span>
  );
}

function Pair({ glyph, label }: { glyph: React.ReactNode; label: string }) {
  return (
    <li className="inline-flex items-center gap-1.5 whitespace-nowrap">
      {glyph}
      {label}
    </li>
  );
}

/**
 * 판 아래 설명은 늘 펼쳐 둔다(접는 버튼 없음). 기호 설명과 조작 안내가 한 덩어리로 이어져, 넓으면 한 줄에 쭉 서고 좁으면 조작 안내가 아래 줄로 내려간다.
 * 기호 설명은 기호 + 짧은 말 쌍(쌍 안은 줄바꿈 없이, 넘치면 쌍 단위로 내려간다)이고 이 판에 있는 기호만 보인다. 두 묶음 사이는 32px 로 벌려 구분한다.
 */
export function Legend({ has }: { has: LegendHas }) {
  return (
    <div className="mt-4 flex flex-wrap items-center gap-x-8 gap-y-2 text-[12px] text-[var(--el-muted)]">
      <ul aria-label="기호 설명" className="flex flex-wrap gap-x-5 gap-y-2">
        <Pair
          glyph={
            <Rail>
              <StopGlyph n={1} col={COL} className="relative" />
            </Rail>
          }
          label="안건 1개"
        />
        {has.capsule ? (
          <Pair
            glyph={
              <Rail>
                <StopGlyph n={3} col={COL} className="relative" />
              </Rail>
            }
            label="안건 여럿"
          />
        ) : null}
        {has.gap ? (
          <Pair
            glyph={
              <span aria-hidden className="flex h-6 w-[34px] shrink-0 items-center">
                <span className="w-full" style={{ height: THIN, background: NORMAL.thin }} />
              </span>
            }
            label="다루지 않음"
          />
        ) : null}
        {has.branch ? (
          <Pair
            glyph={
              <span aria-hidden className="relative block h-6 w-[34px] shrink-0">
                <span className="absolute top-[1px] left-0 h-[6px] w-[10px] rounded-full" style={{ background: NORMAL.ribbon }} />
                <svg width={26} height={10} className="absolute top-[4px] left-[8px] overflow-visible">
                  <path d={forkPath(24, 8)} fill="none" stroke={NORMAL.thin} strokeWidth={THIN} />
                </svg>
                <StopGlyph n={1} small col={COL} className="absolute top-[12px] left-[32px] -translate-x-1/2 -translate-y-1/2" />
              </span>
            }
            label="갈라짐"
          />
        ) : null}
        {has.fold ? (
          <Pair
            glyph={
              <span aria-hidden className="flex h-5 w-[34px] shrink-0 items-center justify-center">
                <FoldPill folded={3} />
              </span>
            }
            label="접힌 안건"
          />
        ) : null}
        {has.join ? (
          <Pair
            glyph={
              <span aria-hidden className="relative block h-6 w-[34px] shrink-0">
                <StopGlyph n={1} col={COL} className="absolute top-[10px] left-[24px] -translate-x-1/2 -translate-y-1/2" />
                <JoinMark half={stopMetrics(1, false, COL).half} className="absolute top-[10px] left-[24px]" />
              </span>
            }
            label="앞 안건 둘"
          />
        ) : null}
      </ul>

      <ul aria-label="조작 안내" className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <li className="whitespace-nowrap">올리면 미리 보기</li>
        <li className="whitespace-nowrap">누르면 자세히</li>
        <li className="whitespace-nowrap">끌어서 이동</li>
        <li className="inline-flex items-center gap-1.5 whitespace-nowrap">
          <Badge render={<kbd />} variant="outline" className="bg-[var(--el-surface-card)] font-normal text-[var(--el-muted)]">
            Esc
          </Badge>
          닫기
        </li>
      </ul>
    </div>
  );
}
