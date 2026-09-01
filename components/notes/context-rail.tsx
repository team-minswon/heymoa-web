"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ChevronDown, Sparkles } from "lucide-react";

import { ContextCandidateCard } from "@/components/notes/context-candidate-card";
import { useNoteRealtime } from "@/components/notes/note-realtime-provider";
import { InlineRetry } from "@/components/ui/inline-retry";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { ContextCandidateHead } from "@/lib/notes/context-candidates/contract";
import {
  CONTEXT_KIND_ICON,
  CONTEXT_KIND_LABEL,
  CONTEXT_OPERATION_LABEL,
  CONTEXT_OUTCOME_KINDS,
  CONTEXT_OUTCOME_LABEL,
} from "@/lib/notes/context-candidates/presentation";
import type {
  ContextActivity,
  ContextCard,
} from "@/lib/notes/context-candidates/reducer";
import { cn } from "@/lib/utils";

/**
 * 회의 중 맥락 후보 레일.
 *
 * **이 화면은 실시간 요약이 아니다.** 끝난 발화에서 남길 만한 변화만 사건이 되고, 대부분의
 * 분석 배치는 사건을 0건 낸다. 그 sparse 함을 감추지 않는다 — 빈도를 올리려고 잡담이나
 * 진행 중인 생각까지 올리면 신뢰가 먼저 무너진다.
 *
 * 그래서 **갱신 띠가 살아 있음을 대신 말한다.** 사건이 안 와도 분석은 돌고 있고, 그 사실을
 * 따로 보이지 않으면 사용자는 「멈춘 것」과 「남길 것이 없는 것」을 구분하지 못한다.
 *
 * 시각의 기준은 서버가 준 `occurredAt` 이다. **수신 시각을 쓰면 안 된다** — 재연결 직후
 * 「방금」이 되어 한참 전에 멈춘 lane 을 살아 있다고 보고한다.
 */

type Filter = "ALL" | "OUTCOME" | "DISCUSSION" | "REFERENCE";

const FILTERS: Array<{
  value: Filter;
  label: string;
  kinds?: ReadonlySet<ContextCandidateHead["kind"]>;
}> = [
  { value: "ALL", label: "전체" },
  { value: "OUTCOME", label: "결론", kinds: CONTEXT_OUTCOME_KINDS },
  {
    value: "DISCUSSION",
    label: "논의 중",
    kinds: new Set(["AGENDA", "ISSUE", "QUESTION"]),
  },
  {
    value: "REFERENCE",
    label: "참고",
    kinds: new Set(["STATUS_REPORT", "INSIGHT"]),
  },
];

/**
 * 묶음의 순서. **필터 칩과 같은 차례다**(결론 → 논의 중 → 참고) — 화면 위의 칩과 아래의
 * 묶음이 다른 순서로 서면 같은 목록을 두 가지로 부르는 셈이 된다.
 *
 * design.pen 신판 G5(`ywpDW`)가 종료 직후 레일을 이렇게 묶는다. 거기 있는 체크박스·담당자·
 * 기한·확정 버튼은 우리 계약에 없어서 가져오지 않는다 — 묶는 구조와 머리 활자만 쓴다.
 */
const GROUP_ORDER: ReadonlyArray<ContextCandidateHead["kind"]> = [
  "DECISION",
  "ACTION_ITEM",
  "AGENDA",
  "ISSUE",
  "QUESTION",
  "STATUS_REPORT",
  "INSIGHT",
];

function activityCopy(activity: ContextActivity) {
  if (activity.type === "batch") {
    return {
      title: "배치 적용",
      detail: `전사 ${activity.fromSequence}–${activity.toSequence} · ${
        activity.applyStatus === "APPLIED" ? "전체 기록" : "일부 기록"
      }`,
    };
  }
  if (activity.type === "sync") {
    return { title: "REST 정본 동기화", detail: "누락 revision 복구" };
  }
  return {
    title: `${CONTEXT_KIND_LABEL[activity.kind]} · ${
      CONTEXT_OPERATION_LABEL[activity.operation]
    }`,
    detail: `revision ${activity.revision}`,
  };
}

function EventProcessingFlow({
  activities,
  freshness,
}: {
  activities: ContextActivity[];
  freshness: string | null;
}) {
  const reduced = useReducedMotion();
  const [open, setOpen] = useState(false);
  const recent = activities.slice(0, 3);
  // activities는 최신 순이다. 복구가 이미 왔는데 과거 gap이 남아 있다고
  // 현재도 경고로 보이면 안 된다.
  const caution = recent[0]?.outcome === "RESYNC_REQUIRED";
  const expanded = open || caution;
  const status =
    activities.length === 0
      ? "이벤트 대기 중"
      : caution
        ? "정본 확인 필요"
        : "실시간 동기화 정상";

  return (
    <section
      aria-label="실시간 이벤트 처리"
      className="shrink-0 overflow-hidden border-y border-[var(--el-hairline-soft)]"
    >
      {/* pen `Tjt99`: 위아래 hairline 띠. 왼쪽은 점과 문구, 오른쪽은 「처리 내역」 알약이다. */}
      <button
        type="button"
        aria-label="처리 내역"
        aria-expanded={expanded}
        onClick={() => setOpen((current) => !current)}
        className="flex w-full items-center justify-between gap-2 px-4 py-[9px] text-left"
      >
        <span className="flex min-w-0 items-center gap-2">
          <span
            aria-hidden
            className={cn(
              // pen `KaVZi`: 3px 바깥 테두리가 점을 감싸 띠 위에서 떠 보인다.
              "size-1.5 shrink-0 rounded-full bg-[var(--el-success)] ring-[3px] ring-[#00000008]",
              activities.length === 0 && "bg-[var(--el-muted-soft)]",
              caution && "bg-[var(--el-error)]"
            )}
          />
          <span
            className={cn(
              "truncate text-[11.5px] text-[var(--el-muted)]",
              caution && "font-medium text-[var(--el-error-strong)]"
            )}
          >
            {freshness ? `${status} · ${freshness}` : status}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-1 rounded-[7px] border border-[var(--el-hairline)] bg-[var(--el-canvas-soft)] px-[9px] py-1">
          <span className="text-[11.5px] text-[var(--el-muted)]">
            처리 내역
          </span>
          <ChevronDown
            aria-hidden
            className={cn(
              "size-3 text-[var(--el-muted-soft)] transition-transform",
              expanded && "rotate-180"
            )}
          />
        </span>
      </button>

      <AnimatePresence initial={false}>
        {expanded ? (
          <motion.div
            key="details"
            initial={reduced ? false : { height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: reduced ? 0 : 0.18 }}
            className="overflow-hidden border-t border-[var(--el-hairline)]"
          >
            <div className="grid grid-cols-[1fr_auto_1fr_auto_1fr] items-center gap-1 border-b border-[var(--el-hairline-soft)] px-4 py-2.5">
              {[
                ["01", "배치 수신"],
                ["02", "후보 변경"],
                ["03", "REST 수렴"],
              ].map(([step, label], index) => (
                <div key={step} className="contents">
                  <div className="min-w-0">
                    <span className="block font-mono text-[11px] tabular-nums text-[var(--el-muted-soft)]">
                      {step}
                    </span>
                    <span className="block truncate text-[12px] font-medium text-[var(--el-body-strong)]">
                      {label}
                    </span>
                  </div>
                  {index < 2 ? (
                    <span
                      aria-hidden
                      className="h-px w-3 bg-[var(--el-hairline)]"
                    />
                  ) : null}
                </div>
              ))}
            </div>

            {recent.length === 0 ? (
              <p className="px-4 py-2.5 text-[12px] text-[var(--el-muted-soft)]">
                이벤트를 기다리고 있습니다
              </p>
            ) : (
              <ol
                aria-label="최근 처리 내역"
                className="divide-y divide-[var(--el-hairline-soft)]"
              >
                {recent.map((activity) => {
                  const copy = activityCopy(activity);
                  const activityCaution =
                    activity.outcome === "RESYNC_REQUIRED";
                  return (
                    <li
                      key={activity.key}
                      className="grid grid-cols-[7px_minmax(0,1fr)_auto] items-center gap-2.5 px-4 py-2"
                    >
                      <span
                        aria-hidden
                        className={cn(
                          "size-1.5 rounded-full bg-[var(--el-success)]",
                          activity.outcome === "ABSORBED" &&
                            "bg-[var(--el-muted-soft)]",
                          activityCaution && "bg-[var(--el-error)]"
                        )}
                      />
                      <span className="min-w-0">
                        <span className="block truncate text-[12px] text-[var(--el-ink)]">
                          {copy.title}
                        </span>
                        <span className="block truncate font-mono text-[11px] tabular-nums text-[var(--el-muted-soft)]">
                          {copy.detail}
                        </span>
                      </span>
                      <span
                        className={cn(
                          "text-[12px] font-medium text-[var(--el-success-strong)]",
                          activity.outcome === "ABSORBED" &&
                            "text-[var(--el-muted)]",
                          activityCaution && "text-[var(--el-error-strong)]"
                        )}
                      >
                        {CONTEXT_OUTCOME_LABEL[activity.outcome]}
                      </span>
                    </li>
                  );
                })}
              </ol>
            )}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </section>
  );
}

/** 마지막 갱신을 사람 말로. 서버 시각과 지금의 차이다. */
export function formatFreshness(lastBatchAt: string | null, now: number) {
  if (!lastBatchAt) return null;
  const elapsed = now - Date.parse(lastBatchAt);
  if (!Number.isFinite(elapsed)) return null;
  if (elapsed < 45_000) return "방금";
  const minutes = Math.round(elapsed / 60_000);
  if (minutes < 60) return `${minutes}분 전`;
  return `${Math.floor(minutes / 60)}시간 전`;
}

function matches(card: ContextCandidateHead, filter: Filter) {
  if (filter === "ALL") return true;
  return FILTERS.find((option) => option.value === filter)?.kinds?.has(
    card.kind
  );
}

/**
 * 흐르는 시계.
 *
 * **렌더 중에 `Date.now()` 를 부르지 않는다.** 순수하지 않아 hydration 이 어긋나고, 더 나쁜
 * 것은 **다시 렌더될 때만 값이 바뀐다**는 것이다. 사건이 안 오면 이 레일은 몇 분씩 리렌더가
 * 없으므로 「방금」이 30분째 「방금」으로 남는다 — 갱신 띠가 하려는 일의 정반대다.
 *
 * 서버에는 타이머가 없으므로 첫 값은 `null` 이고 서버·클라이언트가 같다. 브라우저에서는
 * lazy initializer 가 마운트 전에 한 번 잡는다 — effect 안에서 곧장 `setState` 하면
 * 마운트마다 렌더가 한 번 더 돈다.
 */
function useNow(intervalMs: number) {
  const [now, setNow] = useState<number | null>(() =>
    typeof window === "undefined" ? null : Date.now()
  );
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs]);
  return now;
}

export function ContextRail({
  onEvidenceSelect,
  className,
}: {
  onEvidenceSelect: (segmentId: string) => void;
  className?: string;
}) {
  const { context } = useNoteRealtime();
  const [filter, setFilter] = useState<Filter>("ALL");
  /**
   * **「전체」를 훑는 화면으로 그릴지.**
   *
   * 켜면 그 화면만 유형을 왼쪽 거터로 뽑고, 끄면 네 화면이 모두 유형을 메타 줄에 둔다
   * (`ContextCandidateCard` 의 두 벌).
   *
   * 켜 두든 꺼 두든 **테두리는 두 벌이 같이 쓴다** — 다른 것은 안쪽 배치뿐이다.
   */
  const SCAN_ALL_TAB = true;
  const scan = SCAN_ALL_TAB && filter === "ALL";

  const candidates = useMemo(
    () => context.cards.flatMap((card) => [card, ...card.results]),
    [context.cards]
  );

  const visible = useMemo<ContextCard[]>(
    () =>
      context.cards.filter(
        (card) =>
          matches(card, filter) ||
          card.results.some((result) => matches(result, filter))
      ),
    [context.cards, filter]
  );

  /**
   * 유형별 묶음. **비어 있는 유형은 머리도 안 그린다** — 그 회의에 안 나온 종류의 제목만
   * 서 있으면 목록이 아니라 목차가 된다.
   *
   * 묶음 안은 시간순 그대로다. `selectCards` 가 이미 `createdSequence` 로 정렬해 두었고
   * `filter` 는 순서를 안 건드린다.
   */
  const groups = useMemo(
    () =>
      GROUP_ORDER.map((kind) => ({
        kind,
        cards: visible.filter((card) => card.kind === kind),
      })).filter((group) => group.cards.length > 0),
    [visible]
  );

  // **목록에 보이는 것과 같은 수를 센다.** 결과 후보도 카드이므로 함께 센다.
  const total = candidates.length;
  // 「방금」의 유효 구간이 45초라 그보다 촘촘히 잰다.
  const now = useNow(20_000);
  const freshness =
    now === null ? null : formatFreshness(context.state.lastBatchAt, now);

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col", className)}>
      {/* **띠는 스크롤 밖이다**(design.pen 신판 `r8G5DL`). 레일 헤더 바로 아래 붙어 항상
          보인다 — 사건이 안 와도 분석이 도는 것을 말하는 자리라, 스크롤에 밀려 사라지면
          그 일을 못 한다. */}
      <EventProcessingFlow
        activities={context.state.activities}
        freshness={freshness}
      />
      <ScrollArea
        className="min-h-0 flex-1"
        viewportClassName="overflow-x-hidden!"
      >
        <div className="flex flex-col gap-[18px] px-4 pt-[22px] pb-5">
          <div className="flex items-center gap-2.5">
            <h3
              id="context-rail-heading"
              className="text-[19px] font-semibold leading-none tracking-[-0.3px] text-[var(--el-ink)]"
            >
              사건 흐름
            </h3>
            {/* **「지금까지」가 진행 중임을 말한다.** 맨 숫자는 「총 N건 = 이게 전부다」로
                읽히는데 이 원장은 완결이 아니다. */}
            {/* pen `dERbn`: 개수는 알약 안에 든다 — 「지금까지」와 숫자가 한 덩어리라야
                「총 N건 = 이게 전부다」로 안 읽힌다. 이 원장은 회의가 끝날 때까지 는다. */}
            {/* pen `dERbn` 은 「지금까지」와 숫자를 두 활자로 가르지만 **한 텍스트 노드로
                둔다** — 나눠 놓으면 「지금까지2건」으로 읽히고, 그 문구를 통째로 고정하는
                테스트(`완결을 주장하지 않는다`)도 잡지 못한다. 잃는 것은 숫자의 굵기뿐이다. */}
            <span className="ml-auto shrink-0 rounded-full border border-[var(--el-hairline)] bg-[var(--el-canvas-soft)] px-[9px] py-[3px] text-[11px] tabular-nums text-[var(--el-muted)]">
              {`지금까지 ${total}건`}
            </span>
          </div>

          <p className="-mt-2 text-[12px] leading-[1.5] text-[var(--el-muted-soft)]">
            끝난 발화에서 남길 만한 변화만 쌓입니다.
          </p>

          {/* **분류 체계를 묶어 이름을 준다.** 안 묶으면 스크린리더가 유형 버튼을 맥락 없는
              토글로 읽어서, 무엇을 고르는 것인지 알 수 없다. */}
          {/* pen `SqKzq`: 알약 칩이고 **라벨과 개수가 따로 선다** — 개수는 mono 라 자릿수가
              늘어도 라벨이 안 밀린다. 고른 것만 잉크 면에 그림자 하나. */}
          <div
            role="group"
            aria-label="사건 범위로 좁히기"
            className="flex flex-wrap gap-1.5"
          >
            {FILTERS.map((option) => {
              const active = option.value === filter;
              const count = candidates.filter((candidate) =>
                matches(candidate, option.value)
              ).length;
              return (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={active}
                  // 라벨과 개수가 다른 요소라 그냥 두면 「전체7」로 읽힌다.
                  aria-label={`${option.label} ${count}`}
                  onClick={() => setFilter(option.value)}
                  className={cn(
                    "flex shrink-0 items-center gap-[5px] rounded-full px-[11px] py-1.5 text-[12px] transition-colors",
                    active
                      ? "bg-[var(--el-ink)] font-semibold text-[var(--el-on-primary)] shadow-[0_1px_3px_#00000018]"
                      : "border border-[var(--el-hairline)] font-medium text-[var(--el-muted)] hover:text-[var(--el-ink)]"
                  )}
                >
                  {option.label}
                  <span
                    className={cn(
                      "font-mono text-[11px] font-normal tabular-nums",
                      active ? "text-white/60" : "text-[var(--el-muted-soft)]"
                    )}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {context.loading ? (
            // **로딩은 빈 상태가 아니다.** 아직 모르는 것을 「없다」고 말하면, 사용자가
            // 후보 0건을 사실로 읽는다 — 실패를 빈 상태로 접던 것과 같은 병이다.
            //
            // 기하를 실제 카드에 맞춘다. 카드 하나는 본문 한 줄(13/1.6)과 메타 한 줄이고
            // 목록 gap 은 14 다. 안 맞추면 도착하는 순간 목록이 튄다.
            <ul
              aria-label="정리 결과를 불러오는 중"
              className="flex flex-col gap-3.5"
            >
              {[0, 1, 2].map((row) => (
                <li
                  key={row}
                  className="rounded-[12px] border border-[var(--el-hairline)] p-3.5"
                >
                  <div className="flex flex-col gap-[5px]">
                    <Skeleton className="h-[20px] w-[85%]" />
                    <Skeleton className="h-[18px] w-28" />
                  </div>
                </li>
              ))}
            </ul>
          ) : context.failed ? (
            // **조회 실패는 빈 상태가 아니다.** 「사건이 없다」로 그리면 사용자가 후보
            // 0건을 사실로 믿는다 — 실제로는 서버가 못 답한 것이다.
            <InlineRetry
              label="정리 결과를 불러오지 못했습니다."
              onRetry={context.retry}
            />
          ) : visible.length === 0 ? (
            // **오류가 아니다.** 분류할 끝난 발화가 없다는 사실은 정상 경로다.
            <p className="py-3.5 text-[13px] leading-relaxed text-[var(--el-muted)]">
              {context.cards.length === 0
                ? "아직 정리할 발화가 없습니다. 발화가 끝나면 여기에 쌓입니다."
                : "이 유형으로 정리된 사건이 아직 없습니다."}
            </p>
          ) : (
            // pen `TivBS`: 묶음 사이 24. 묶음을 가르던 선은 머리 안으로 들어갔다.
            <div className="flex flex-col gap-6">
              {/**
                * **「전체」만 묶는다.** 유형을 좁혀 놓은 화면은 이미 한 묶음이라, 거기 또
                * 머리를 달면 목록 하나에 제목이 하나 붙을 뿐이다.
                *
                * 묶음마다 제 목록을 제 머리에 묶는다(`aria-labelledby`) — 스크린리더가
                * 「무엇의 목록인가」를 묶음 단위로 읽어야 훑는 순서가 화면과 같아진다.
                */}
              {(scan
                ? groups
                : [{ kind: null, cards: visible }]
              ).map((group) => {
                const headingId = group.kind
                  ? `context-group-${group.kind}`
                  : "context-rail-heading";
                return (
                  <section key={group.kind ?? "all"}>
                    {group.kind ? (
                      // pen `A3guYz`: 아이콘 · 라벨 · **남는 폭을 채우는 줄** · mono 개수.
                      // 줄이 라벨과 개수 사이를 지나서 머리 자체가 구분선 노릇을 한다.
                      <div className="flex items-center gap-[9px] px-0.5 pb-[11px]">
                        {(() => {
                          const KindIcon = CONTEXT_KIND_ICON[group.kind];
                          return (
                            <KindIcon
                              aria-hidden
                              className="size-[15px] shrink-0 text-[var(--el-body)]"
                            />
                          );
                        })()}
                        <h4
                          id={headingId}
                          className="text-[14px] font-semibold text-[var(--el-ink)]"
                        >
                          {CONTEXT_KIND_LABEL[group.kind]}
                        </h4>
                        <span
                          aria-hidden
                          className="h-px min-w-0 flex-1 bg-[var(--el-hairline)]"
                        />
                        <span className="shrink-0 font-mono text-[11px] tabular-nums text-[var(--el-muted-soft)]">
                          {group.cards.length}
                        </span>
                      </div>
                    ) : null}
                    <ul
                      aria-labelledby={headingId}
                      className="flex flex-col gap-[11px]"
                    >
                      {group.cards.map((card) => (
                        <ContextCandidateCard
                          key={card.candidateId}
                          card={card}
                          onEvidenceSelect={onEvidenceSelect}
                          kindInGroupHeader={group.kind !== null}
                        />
                      ))}
                    </ul>
                  </section>
                );
              })}
            </div>
          )}

          {/* pen `GfRl8`: 목록 끝의 한 줄. **원장이 여기서 끝난 게 아니라는 말**이라
              사건이 있을 때만 둔다 — 빈 화면에서는 빈 상태 문구가 이미 그 말을 한다. */}
          {!context.loading && !context.failed && visible.length > 0 ? (
            <p className="flex items-center justify-center gap-1.5 border-t border-[var(--el-hairline-soft)] pt-3.5 text-[11px] text-[var(--el-muted-soft)]">
              <Sparkles aria-hidden className="size-3 shrink-0" />
              회의가 끝날 때까지 계속 쌓입니다
            </p>
          ) : null}
        </div>
      </ScrollArea>
    </div>
  );
}
