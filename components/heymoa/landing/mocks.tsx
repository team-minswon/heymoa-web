import type { ReactNode } from "react";
import { CalendarDays } from "lucide-react";

import { PersonAvatar } from "@/components/heymoa/person-avatar";
import { unnamedSpeakerAvatarKey } from "@/lib/people/avatar-key";
import { TimelineToneIcon } from "@/components/notes/timeline-tone-icon";

/**
 * 「작동 방식」 카드 셋 안에 들어가는 작은 앱 화면 조각. 넓은 화면에서는 창 높이가 184px로
 * 고정이라 `feature-mocks.tsx`(내용만큼 자람)보다 한 단 작게 그린다.
 *
 * **좁은 화면은 시안이 다시 그렸다.** 전사는 구분선 대신 8px 간격, 검토 막대는 바닥 붙이기를
 * 안 한다(창이 자라므로 붙일 바닥이 없다). 글자도 한 단 크다 — 350px 카드에서 10px는 안 읽힌다.
 *
 * **여기 글자는 전부 삽화다.** 8~11px에 `--lp-faint` 같은 흐린 색을 쓰는 것은 앱 화면의
 * 실제 크기와 색을 따라 그리기 때문이고, 페이지가 직접 하는 말이 아니다. 페이지 문장에
 * 이 색·크기를 쓰면 대비를 잃는다 — 두 쓰임을 섞지 않는다.
 *
 * 세 판은 히어로 시연(`use-demo.ts`)과 **같은 회의**다 — 「3차 스프린트 킥오프」(9월 1일 화요일)의
 * 같은 발화 · 결정 · 할 일을 쓴다. 한 판만 숫자나 날짜가 다르면 세 판이 서로를 반박한다.
 */

/** 회의 중 스크립트의 확정된 한 줄 — 시각과 본문 두 칸(`transcript-view.tsx`). */
function Row({ at, text }: { at: string; text: string }) {
  return (
    <div className="col-span-2 grid grid-cols-subgrid px-1.5 lg:border-b lg:border-[var(--lp-rule-soft)] lg:py-2">
      <span className="font-mono text-[9.5px] leading-[1.7] tabular-nums text-[var(--lp-faint)]">
        {at}
      </span>
      <span className="break-keep text-[11px] leading-[1.55] text-[var(--lp-ink)] lg:text-[10.5px] lg:leading-[1.5] lg:text-[var(--lp-body)]">
        {text}
      </span>
    </div>
  );
}

/**
 * 듣는 동안 — 확정된 발화 셋과 받아 적는 중인 한 줄.
 *
 * **회의 중에는 화자가 없다.** 실시간 발화는 화자 없이 오고(서버가 `speakerLabel = null`로 쓴다),
 * 화자는 회의가 끝난 뒤 화자 분리가 채운다. 그래서 얼굴도 이름도 그리지 않는다.
 *
 * 줄마다 칸 폭이 같아야 본문이 한 세로선에 선다. 시각 칸은 「받아 적는 중」이 들어갈 만큼
 * 넓어야 해서 고정 폭 대신 **바깥 격자 하나를 줄들이 나눠 쓴다**(`subgrid`) — 글꼴이 바뀌어도
 * 칸이 글자에 맞춰 늘고 넘치지 않는다.
 */
export function MiniTranscript() {
  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-2 gap-y-2 lg:gap-y-0">
      <Row at="00:14" text="결제 화면 개편은 다음으로 미뤘습니다." />
      <Row at="00:31" text="저는 이번에 합류해서 그 맥락을 모릅니다." />
      {/* 미룬 이유는 이 회의 발화가 아니라 2차 회의록에 있다 — 그래서 타임라인이 아니라 에이전트를 가리킨다(히어로 대본 00:44와 같은 말). */}
      <Row at="00:44" text="에이전트한테 물어보면 돼요." />
      {/* 받아 적는 줄은 시각 자리에 상태를 적는다 — 아직 확정 안 된 발화라 시각도 확정이
          아니다. 바탕만 옅게 깔고 x좌표는 확정 줄과 같다. 앞부분은 업체가 확정한 글자,
          흐린 뒷부분은 다음 조각이 갈아치울 글자다. 커서는 붉지 않다.
          **깜박이지 않는다** — 이 그림은 제품 시연 밖이라 시연의 「일시정지」가 닿지 않는다. 끝없이
          깜박이는데 멈출 길이 없으면 WCAG 2.2.2 에 걸린다. 점과 커서를 멈춘 채로 그린다. */}
      <div className="col-span-2 grid grid-cols-subgrid rounded-md bg-[var(--lp-canvas)] px-1.5 py-1 lg:py-2">
        <span className="flex items-center gap-1 self-start whitespace-nowrap text-[9px] leading-[1.8] text-[var(--lp-muted)]">
          <span
            aria-hidden
            className="size-[5px] shrink-0 rounded-full bg-[var(--lp-rec)]"
          />
          받아 적는 중
        </span>
        <span className="break-keep text-[11px] leading-[1.55] text-[var(--lp-ink)] lg:text-[10.5px] lg:leading-[1.5] lg:text-[var(--lp-body)]">
          그럼 로그 수집은 <span className="text-[var(--lp-muted)]">제가 맡겠습</span>
          <span aria-hidden className="ml-[3px] inline-block h-[0.95em] w-px bg-[var(--lp-muted)] align-[-0.12em]" />
        </span>
      </div>
    </div>
  );
}

/** 검토 화면의 섹션 머리 — 이름과 포함한 항목 수(`section-block.tsx`). */
function SectionHead({ title, count }: { title: string; count: number }) {
  return (
    <p className="m-0 mt-2.5 flex items-baseline gap-1 text-[10px] font-semibold text-[var(--lp-ink)] lg:text-[9.5px]">
      {title}
      <span className="font-normal tabular-nums text-[var(--lp-faint)]">{count}</span>
    </p>
  );
}

/** 결정은 채운 체크 — 타임라인 · 검토 화면과 같은 모양이다. */
function DecisionMark() {
  return (
    <span aria-hidden className="flex shrink-0 [&_svg]:size-3">
      <TimelineToneIcon tone="decision" />
    </span>
  );
}

/** 결정 · 할 일 한 줄(`review-row.tsx`). 내용은 한 줄로 자르고 오른쪽에 시각이나 담당 · 기한이 선다. */
function ItemRow({ mark, text, children }: { mark: ReactNode; text: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-1.5 border-b border-[var(--lp-rule-soft)] py-[5px]">
      {mark}
      <span className="min-w-0 flex-1 truncate text-[11px] text-[var(--lp-ink)] lg:text-[10.5px]">
        {text}
      </span>
      {children}
    </div>
  );
}

function TimeChip({ at }: { at: string }) {
  return (
    <span className="inline-flex h-[15px] shrink-0 items-center rounded-[4px] bg-[var(--lp-canvas)] px-1 text-[9px] tabular-nums text-[var(--lp-body)] lg:text-[8.5px]">
      {at}
    </span>
  );
}

/**
 * 끝나고 나면 — 요약 탭의 검토 문서 첫머리(`components/notes/review/*`).
 *
 * 머리(「검토 중」 배지, 요약/그래프 전환, 세리프 제목) 뒤에 결정과 할 일을 한 줄씩 잘라 보인다.
 * 섹션 이름은 `lib/notes/review/sections.ts`가 정한 것 그대로다. 「언제 정해졌나」 · 요약 · 주제는
 * 184px에 안 들어가 뺐고, 개수(2 · 2)는 대본의 결정 둘 · 할 일 둘이라 03 카드의 막대 숫자와 같다.
 * 결정은 채운 체크 + 시각, 할 일은 빈 상자 + 담당 얼굴 + 기한 칩이다 — 앱의 줄 모양 그대로.
 */
export function MiniReview() {
  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between">
        <span className="inline-flex h-[15px] items-center rounded-[4px] bg-[var(--lp-rule-soft)] px-[5px] text-[9px] font-semibold text-[var(--lp-body)] lg:text-[8.5px]">
          검토 중
        </span>
        <span className="inline-flex rounded-full bg-[var(--lp-rule-soft)] p-px text-[8.5px] font-medium leading-[14px] lg:text-[8px]">
          <span className="rounded-full bg-[var(--lp-card)] px-1.5 text-[var(--lp-ink)] shadow-[0_1px_2px_#33231a10]">
            요약
          </span>
          <span className="px-1.5 text-[var(--lp-muted)]">그래프</span>
        </span>
      </div>
      <p className="m-0 mt-1.5 font-serif text-[14px] font-medium leading-[1.35] tracking-[-0.2px] text-[var(--lp-ink)] lg:text-[13px]">
        3차 스프린트 킥오프
      </p>

      <SectionHead title="결정" count={2} />
      <ItemRow mark={<DecisionMark />} text="결제 화면 개편은 다음 스프린트로 미룬다">
        <TimeChip at="00:14" />
      </ItemRow>

      <SectionHead title="할 일" count={2} />
      <ItemRow
        mark={
          <span
            aria-hidden
            className="size-3 shrink-0 rounded-[3px] border-[1.5px] border-[var(--lp-rule-strong)]"
          />
        }
        text="로그 수집 초안 올리기"
      >
        {/* 검토를 기다리는 때라 화자에 아직 이름이 없다 — 앱도 담당을 「화자 D」로 둔다(히어로 시연과 같다). */}
        <span className="flex shrink-0 items-center gap-1 text-[9.5px] text-[var(--lp-body)] lg:text-[9px]">
          <PersonAvatar name={unnamedSpeakerAvatarKey("D")} size={12} />
          화자 D
        </span>
        {/* 회의가 9월 1일(화)이라 「이번 주 목요일」은 9월 3일이다. 앱은 기한을 요일까지 쓴다. */}
        <span className="inline-flex h-4 shrink-0 items-center gap-[3px] rounded-[5px] bg-[var(--lp-canvas)] px-[5px] text-[9px] tabular-nums text-[var(--lp-body)] lg:text-[8.5px]">
          <CalendarDays aria-hidden className="size-2.5 shrink-0" />
          9월 3일 (목)
        </span>
      </ItemRow>
    </div>
  );
}

/**
 * 그 다음 — 검토 막대(`components/notes/review/confirm-bar.tsx`).
 *
 * 막대는 문서 위에 떠서 「무엇이 프로젝트에 올라가는지」를 세고, 「검토 완료」를 눌러야 올라간다.
 * 위의 줄과 막대의 수는 히어로 시연과 같은 회의다(결정 둘 · 할 일 둘). 이 회의는 지난 결정을 그대로
 * 잇기만 해서 갈아 끼울 이전 결정이 없다 — 그래서 대체 제안과 「이전 결정 N개 끝남」을 그리지 않는다.
 *
 * 넓은 화면에서는 막대를 창 바닥에 붙이고 위로 흰 그라데이션을 깐다 — 앱처럼 글이 막대 뒤로
 * 스며 사라지고, 창이 184px로 같아서 세 카드의 바닥선이 맞는다. 좁은 화면의 창은 내용만큼
 * 자라므로 붙일 바닥이 없어 차례로 쌓는다.
 */
export function MiniConfirmBar() {
  return (
    <div className="relative flex flex-col lg:h-full">
      <ItemRow mark={<DecisionMark />} text="온보딩 이탈을 이번 스프린트의 첫 기준선으로 삼는다">
        <TimeChip at="00:00" />
      </ItemRow>
      <ItemRow mark={<DecisionMark />} text="결제 화면 개편은 다음 스프린트로 미룬다">
        <TimeChip at="00:14" />
      </ItemRow>

      <div className="mt-3 lg:absolute lg:inset-x-0 lg:bottom-0 lg:mt-0 lg:bg-gradient-to-b lg:from-transparent lg:to-[var(--lp-card)] lg:to-40% lg:pt-5">
        <div className="flex items-center gap-2 rounded-[10px] border border-[var(--lp-rule)] bg-[var(--lp-card)] py-1 pr-1 pl-2.5 shadow-[0_2px_8px_#33231a12]">
          <span className="min-w-0 flex-1 break-keep text-[10px] leading-[1.45] text-[var(--lp-body)] lg:text-[9.5px]">
            결정 <b className="font-semibold text-[var(--lp-ink)]">2</b>개와 할 일{" "}
            <b className="font-semibold text-[var(--lp-ink)]">2</b>개를 프로젝트에 올립니다
          </span>
          <span aria-hidden className="h-4 w-px shrink-0 bg-[var(--lp-rule)]" />
          <span className="shrink-0 rounded-[7px] bg-[var(--lp-dark)] px-2.5 py-1.5 text-[10px] font-semibold text-[var(--lp-on-dark)] lg:text-[9.5px]">
            검토 완료
          </span>
        </div>
      </div>
    </div>
  );
}
