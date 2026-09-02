import {
  ChevronDown,
  ChevronLeft,
  CircleCheck,
  Copy,
  Link as LinkIcon,
  MessageCircleQuestion,
  Minimize2,
  MoreHorizontal,
  SquareCheckBig,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { CONTAINER, SECTION_X } from "@/components/heymoa/landing/shell";

/**
 * 히어로 아래 제품 화면. 크림 매트(1120 · r24 · pad24) 위에 흰 앱 창(r14 · 그림자)을 얹고,
 * 창 안에 상단바 · 전사 · 오른쪽 레일을 그린다.
 *
 * **이 안의 글자는 삽화다.** 시각 `#b5a698`이나 10~11px 라벨은 페이지가 하는 말이 아니라
 * 앱 화면을 그린 그림이라 실제 앱의 크기와 색을 따른다. 페이지가 직접 하는 말(`--lp-body`
 * 이상)과 섞어 쓰지 않는다 — 대비 기준이 다르다.
 *
 * 모바일에서는 전사와 레일을 한 창 안에서 세로로 쌓는다. 실제 앱도 좁은 화면에서는 같은
 * 노트 안에서 탭으로 오가므로 창을 쪼개지 않는 편이 맞다.
 */

const TINT: Record<string, string> = {
  김민서: "#366c4f",
  박지훈: "#8a5a3c",
  이서연: "#3d5a80",
  정우재: "#7a4a63",
};

type Line = { at: string; who: string; text: string };

const TRANSCRIPT: Line[] = [
  { at: "00:00", who: "김민서", text: "이번 스프린트는 온보딩 이탈부터 봅니다. 지난주에 남긴 가설 두 개를 먼저 정리하죠." },
  { at: "00:14", who: "박지훈", text: "지난 회의에서 결제 화면 개편은 다음으로 미뤘습니다. 그 결정 그대로 갑니다." },
  { at: "00:31", who: "이서연", text: "저는 이번에 합류해서 그 맥락을 모릅니다. 왜 미뤘는지 다시 볼 수 있을까요?" },
  { at: "00:44", who: "김민서", text: "에이전트가 근거를 붙여 뒀어요. 오른쪽 정리에서 결정 항목을 펼치면 됩니다." },
  { at: "01:02", who: "정우재", text: "그럼 온보딩 이탈 로그 수집은 제가 맡겠습니다. 이번 주 목요일까지 초안 올릴게요." },
  { at: "01:19", who: "박지훈", text: "좋습니다. 그 작업은 Linear 이슈로 바로 내보내는 게 좋겠어요." },
  { at: "01:33", who: "이서연", text: "그 이슈에 이 회의 결정을 근거로 같이 붙여 주세요. 다음에 들어올 사람도 볼 수 있게요." },
  { at: "01:48", who: "김민서", text: "네. 승인 화면에서 확인하고 내보내겠습니다. 오늘 남길 건 여기까지입니다." },
];

/**
 * 레일 항목의 메타. **실제 컴포넌트가 붙이는 말만 쓴다** — 유형, 동작(새로 포착 · 내용 보강 ·
 * 내용 정정 · 철회 · 질문 해결), 상태(철회됨 · 답변됨 · 답 대기), 그리고 「수정 N」.
 * 「근거 3」이나 「승인 전」 같은 말은 코드에 없다.
 */
type Item = { title: string; at: string; more: number; meta: string };
type Group = { kind: string; count: number; head: LucideIcon; mark: LucideIcon; items: Item[] };

const GROUPS: Group[] = [
  {
    kind: "결정",
    count: 2,
    head: LinkIcon,
    mark: CircleCheck,
    items: [
      { title: "결제 화면 개편은 다음 스프린트로 미룬다", at: "00:14", more: 3, meta: "결정 · 내용 보강" },
      { title: "온보딩 이탈 지표를 이번 주 기준선으로 삼는다", at: "00:52", more: 2, meta: "결정 · 수정 1" },
    ],
  },
  {
    kind: "할 일",
    count: 2,
    head: SquareCheckBig,
    mark: SquareCheckBig,
    items: [
      { title: "온보딩 이탈 로그 수집 초안 · 목요일", at: "01:02", more: 2, meta: "할 일" },
      { title: "카드 결제 실패 재시도 정책 정하기", at: "01:19", more: 1, meta: "할 일 · 수정 1" },
    ],
  },
  {
    kind: "질문",
    count: 1,
    head: MessageCircleQuestion,
    mark: MessageCircleQuestion,
    items: [
      { title: "결제 화면 개편을 미룬 이유는 무엇인가", at: "00:31", more: 2, meta: "질문 · 답변됨 · 수정 1" },
    ],
  },
];

const FILTERS: Array<[string, number, boolean]> = [
  ["전체", 5, true],
  ["결론", 2, false],
  ["논의 중", 2, false],
  ["참고", 1, false],
];

export function ProductShot() {
  return (
    <section className={`${SECTION_X} flex flex-col items-center pt-12 pb-16 lg:pt-14 lg:pb-25`}>
      <div
        className={`${CONTAINER} box-border rounded-[24px] border border-[var(--lp-rule)] bg-[var(--lp-cream)] p-3.5 lg:p-6`}
      >
        <div className="overflow-hidden rounded-[14px] border border-[var(--lp-rule)] bg-[var(--lp-card)] shadow-[0_10px_28px_-6px_#33231a1f]">
          <Topbar />
          <div className="flex flex-col items-stretch lg:flex-row lg:items-start">
            <Transcript />
            <Rail />
          </div>
        </div>
      </div>
    </section>
  );
}

function Topbar() {
  return (
    <div className="flex items-center gap-3 border-b border-[var(--lp-rule-soft)] px-4 py-3">
      <div className="flex min-w-0 flex-1 items-center gap-2.5">
        <ChevronLeft aria-hidden className="size-[17px] shrink-0 text-[var(--lp-body)]" />
        <Minimize2 aria-hidden className="hidden size-[15px] shrink-0 text-[var(--lp-faint)] lg:block" />
        <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-[var(--lp-rule-soft)] px-[9px] py-1">
          <span aria-hidden className="block size-1.5 shrink-0 rounded-full bg-[#8a7a6d]" />
          <span className="text-[11px] font-semibold text-[var(--lp-body)]">종료됨</span>
        </span>
        <h2 className="m-0 truncate break-keep text-[14px] font-semibold text-[var(--lp-ink)]">
          3차 스프린트 킥오프
        </h2>
      </div>
      <div className="flex shrink-0 items-center gap-0.5 rounded-full bg-[var(--lp-rule-soft)] p-[3px]">
        {(["정보", "전사", "요약"] as const).map((t) => (
          <span
            key={t}
            className={
              t === "전사"
                ? "flex items-center rounded-full bg-[var(--lp-card)] px-3.5 py-[5px] text-[12px] font-semibold text-[var(--lp-ink)]"
                : "hidden items-center rounded-full px-3.5 py-[5px] text-[12px] font-medium text-[#8a7a6d] sm:flex"
            }
          >
            {t}
          </span>
        ))}
      </div>
      <MoreHorizontal aria-hidden className="size-[17px] shrink-0 text-[#8a7a6d]" />
    </div>
  );
}

function Transcript() {
  return (
    <div className="flex min-w-0 flex-1 flex-col border-b border-[var(--lp-rule-soft)] px-4 pt-4 pb-5 lg:border-b-0 lg:px-5 lg:pt-4 lg:pb-6">
      <div className="flex items-center justify-between">
        <h3 className="m-0 text-[13px] font-semibold text-[#8a7a6d]">전사</h3>
        <span className="flex items-center gap-1.5 rounded-[7px] border border-[var(--lp-rule)] px-2.5 py-[5px]">
          <Copy aria-hidden className="size-3 text-[#8a7a6d]" />
          <span className="text-[11px] font-medium text-[var(--lp-body)]">복사</span>
        </span>
      </div>
      <ul className="m-0 mt-1.5 list-none p-0">
        {TRANSCRIPT.map((l) => (
          <li
            key={l.at}
            className="flex gap-3 border-b border-[var(--lp-rule-soft)] py-[13px]"
          >
            <span className="w-[38px] shrink-0 font-mono text-[11px] font-medium leading-[1.7] tabular-nums text-[var(--lp-faint)]">
              {l.at}
            </span>
            <span
              aria-hidden
              style={{ background: TINT[l.who] }}
              className="flex size-[22px] shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
            >
              {l.who.slice(0, 1)}
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
              <p className="m-0 text-[12px] font-semibold text-[var(--lp-ink)]">{l.who}</p>
              <p className="m-0 break-keep text-[13px] leading-[1.65] text-[var(--lp-body)]">
                {l.text}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Rail() {
  return (
    <div className="box-border flex w-full shrink-0 flex-col bg-[var(--lp-canvas)] lg:w-[380px] lg:border-l lg:border-[var(--lp-rule-soft)]">
      <div className="flex gap-[18px] border-b border-[var(--lp-rule-soft)] px-3.5">
        {(["실시간 정리", "내 에이전트"] as const).map((t) => (
          <span
            key={t}
            className={`flex flex-col break-keep px-0.5 pt-[13px] pb-[11px] text-[12.5px] ${
              t === "실시간 정리"
                ? "border-b-2 border-[var(--lp-accent)] font-semibold text-[var(--lp-ink)]"
                : "border-b-2 border-transparent font-medium text-[#8a7a6d]"
            }`}
          >
            {t}
          </span>
        ))}
      </div>

      <div className="flex flex-col px-3.5 pt-3.5 pb-5">
        <div className="flex items-center justify-between">
          <h3 className="m-0 break-keep text-[14px] font-bold text-[var(--lp-ink)]">사건 흐름</h3>
          <div className="flex items-center gap-1 rounded-full bg-[var(--lp-rule-soft)] px-[9px] py-[3px]">
            <span className="text-[10.5px] font-medium text-[#8a7a6d]">지금까지</span>
            <span className="font-mono text-[10.5px] font-semibold tabular-nums text-[var(--lp-body)]">
              5건
            </span>
          </div>
        </div>
        <p className="m-0 mt-1.5 break-keep text-[11.5px] leading-[1.5] text-[#8a7a6d]">
          이 회의에서 남길 만한 변화만 기록했습니다.
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {FILTERS.map(([label, n, on]) => (
            <span
              key={label}
              className={`flex items-center gap-[5px] rounded-full border px-[9px] py-[5px] ${
                on
                  ? "border-[var(--lp-dark)] bg-[var(--lp-dark)]"
                  : "border-[var(--lp-rule)] bg-[var(--lp-card)]"
              }`}
            >
              <span
                className={`text-[11px] font-semibold ${on ? "text-[var(--lp-on-dark)]" : "text-[var(--lp-body)]"}`}
              >
                {label}
              </span>
              <span
                className={`font-mono text-[11px] font-semibold tabular-nums ${on ? "text-[var(--lp-on-dark-soft)]" : "text-[var(--lp-faint)]"}`}
              >
                {n}
              </span>
            </span>
          ))}
        </div>

        {GROUPS.map(({ kind, count, head: Head, mark: Mark, items }) => (
          <div key={kind}>
            <div className="mt-3.5 flex items-center gap-2 px-0.5">
              <Head aria-hidden className="size-[13px] shrink-0 text-[#8a7a6d]" />
              <span className="text-[11.5px] font-semibold text-[var(--lp-body)]">{kind}</span>
              <span aria-hidden className="block h-px flex-1 bg-[var(--lp-rule)]" />
              <span className="font-mono text-[10.5px] font-semibold tabular-nums text-[var(--lp-faint)]">
                {count}
              </span>
              <ChevronDown aria-hidden className="size-[13px] shrink-0 text-[var(--lp-faint)]" />
            </div>
            <ul className="m-0 list-none p-0">
              {items.map((it) => (
                <li
                  key={it.title}
                  className="mt-2 flex gap-2.5 rounded-[10px] border border-[var(--lp-rule)] bg-[var(--lp-card)] p-[11px] shadow-[0_1px_3px_#33231a14]"
                >
                  <span className="flex size-[26px] shrink-0 items-center justify-center rounded-lg bg-[var(--lp-rule-soft)]">
                    <Mark aria-hidden className="size-3.5 text-[var(--lp-accent)]" />
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <div className="flex gap-2">
                      <p className="m-0 min-w-0 flex-1 break-keep text-[12.5px] font-semibold leading-[1.45] text-[var(--lp-ink)]">
                        {it.title}
                      </p>
                      <span className="flex shrink-0 items-center gap-1.5">
                        <span className="font-mono text-[10px] font-medium tabular-nums text-[var(--lp-faint)]">
                          {it.at}
                        </span>
                        <span className="font-mono text-[10px] font-semibold tabular-nums text-[#8a7a6d]">
                          +{it.more}
                        </span>
                        <ChevronDown aria-hidden className="size-[13px] text-[var(--lp-faint)]" />
                      </span>
                    </div>
                    <p className="m-0 text-[11px] text-[#8a7a6d]">{it.meta}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
