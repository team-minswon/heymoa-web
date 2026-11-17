"use client";

import { useTranslations } from "next-intl";

import { FoldPill, JoinMark, NORMAL, StopGlyph, THIN, forkPath, stopMetrics } from "@/components/projects/agenda-ribbon-column";
import { Badge } from "@/components/ui/badge";

export type LegendHas = { capsule: boolean; gap: boolean; branch: boolean; fold: boolean; join: boolean };

const COL = 40;

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

export function Legend({ has }: { has: LegendHas }) {
  const t = useTranslations("workspace.agendaMap.legend");
  const tActions = useTranslations("common.actions");
  return (
    <div className="mt-4 flex flex-wrap items-center gap-x-8 gap-y-2 text-[12px] text-[var(--el-muted)]">
      <ul aria-label={t("symbols")} className="flex flex-wrap gap-x-5 gap-y-2">
        <Pair
          glyph={
            <Rail>
              <StopGlyph n={1} col={COL} className="relative" />
            </Rail>
          }
          label={t("single")}
        />
        {has.capsule ? (
          <Pair
            glyph={
              <Rail>
                <StopGlyph n={3} col={COL} className="relative" />
              </Rail>
            }
            label={t("multiple")}
          />
        ) : null}
        {has.gap ? (
          <Pair
            glyph={
              <span aria-hidden className="flex h-6 w-[34px] shrink-0 items-center">
                <span className="w-full" style={{ height: THIN, background: NORMAL.thin }} />
              </span>
            }
            label={t("gap")}
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
            label={t("branch")}
          />
        ) : null}
        {has.fold ? (
          <Pair
            glyph={
              <span aria-hidden className="flex h-5 w-[34px] shrink-0 items-center justify-center">
                <FoldPill folded={3} />
              </span>
            }
            label={t("folded")}
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
            label={t("join")}
          />
        ) : null}
      </ul>

      <ul aria-label={t("controls")} className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <li className="whitespace-nowrap">{t("hover")}</li>
        <li className="whitespace-nowrap">{t("click")}</li>
        <li className="whitespace-nowrap">{t("drag")}</li>
        <li className="inline-flex items-center gap-1.5 whitespace-nowrap">
          <Badge render={<kbd />} variant="outline" className="bg-[var(--el-surface-card)] font-normal text-[var(--el-muted)]">
            Esc
          </Badge>
          {tActions("close")}
        </li>
      </ul>
    </div>
  );
}
