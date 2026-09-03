import {
  Bot,
  ChevronDown,
  ChevronLeft,
  CircleCheck,
  CircleQuestionMark,
  Copy,
  Minimize2,
  MoreHorizontal,
  SquareCheck,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { CONTAINER, SECTION_X, SPEAKER_TINT } from "@/components/heymoa/landing/shell";

/**
 * 히어로 아래 제품 화면.
 *
 * **좁은 화면과 넓은 화면이 다른 그림이다.** 아트보드 1440은 크림 매트 위에 창 하나를 얹고
 * 그 안을 전사와 레일로 나누지만, 390은 매트 안에 카드 **둘**을 세로로 쌓는다 — 390px에서
 * 창 하나를 반으로 가르면 양쪽 다 못 읽는다. 전사도 여덟 줄에서 다섯 줄로 줄고, 레일 항목의
 * 메타에서 유형(「결정 ·」)이 빠진다. 바로 위 그룹 머리글이 이미 그 말을 하기 때문이다.
 *
 * 그래서 두 벌을 그리고 `lg`로 가른다. 구조가 달라서 한 트리에 `lg:` 덧칠로는 안 된다.
 *
 * **목업 안에는 제목 태그를 안 쓴다.** 「3차 스프린트 킥오프」나 「전사」는 그린 화면의
 * 일부지 이 문서의 절이 아니다 — `h2`로 두면 제목으로 훑는 사람의 목록에 끼어들어 무엇을
 * 가리키는지 알 수 없는 항목이 된다. 시안이 굵게 그린 것은 시각적 무게였지 위계가 아니다.
 * 같은 이유로 목업 안의 누를 것들도 링크가 아니라 `<span>`이다.
 *
 * **이 안의 글자는 삽화다.** 시각 `#b5a698`이나 9~11px 라벨은 페이지가 하는 말이 아니라
 * 앱 화면을 그린 그림이라 실제 앱의 크기와 색을 따른다. 페이지가 직접 하는 말(`--lp-body`
 * 이상)과 섞어 쓰지 않는다 — 대비 기준이 다르다.
 */

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

/** 좁은 카드는 앞의 다섯 줄까지만 보인다 — 시안이 자른 자리와 같다. */
const TRANSCRIPT_SM = TRANSCRIPT.slice(0, 5);

/**
 * 레일 항목의 메타. **실제 컴포넌트가 붙이는 말만 쓴다** — 유형, 동작(새로 포착 · 내용 보강 ·
 * 내용 정정 · 철회 · 질문 해결), 상태(철회됨 · 답변됨 · 답 대기), 그리고 「수정 N」.
 * 「근거 3」이나 「승인 전」 같은 말은 코드에 없다.
 *
 * `metaSm`은 좁은 카드용이라 유형을 뺀다. 빈 문자열이면 그 줄을 안 그린다.
 */
type Item = { title: string; at: string; more: number; meta: string; metaSm: string };
/**
 * 아이콘은 `lib/notes/context-candidates/presentation.ts`의 `CONTEXT_KIND_ICON` 그대로다 —
 * 결정 `CircleCheck` · 할 일 `SquareCheck` · 질문 `CircleQuestionMark`. 묶음 머리와 카드가
 * **같은 아이콘**을 쓴다(앱이 그렇다). 예전에는 머리에 사슬 아이콘을 그렸는데 앱에 없는
 * 그림이었다.
 */
type Group = { kind: string; count: number; icon: LucideIcon; items: Item[] };

const GROUPS: Group[] = [
  {
    kind: "결정",
    count: 2,
    icon: CircleCheck,
    items: [
      { title: "결제 화면 개편은 다음 스프린트로 미룬다", at: "00:14", more: 3, meta: "결정 · 내용 보강", metaSm: "내용 보강" },
      { title: "온보딩 이탈 지표를 이번 주 기준선으로 삼는다", at: "00:52", more: 2, meta: "결정 · 수정 1", metaSm: "수정 1" },
    ],
  },
  {
    kind: "할 일",
    count: 2,
    icon: SquareCheck,
    items: [
      { title: "온보딩 이탈 로그 수집 초안 · 목요일", at: "01:02", more: 2, meta: "할 일", metaSm: "" },
      { title: "카드 결제 실패 재시도 정책 정하기", at: "01:19", more: 1, meta: "할 일 · 수정 1", metaSm: "수정 1" },
    ],
  },
  {
    kind: "질문",
    count: 1,
    icon: CircleQuestionMark,
    items: [
      { title: "결제 화면 개편을 미룬 이유는 무엇인가", at: "00:31", more: 2, meta: "질문 · 답변됨 · 수정 1", metaSm: "답변됨 · 수정 1" },
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
    <section className={`${SECTION_X} flex flex-col items-center pt-9 pb-16 lg:pt-14 lg:pb-25`}>
      {/* 좁은 매트 — 카드 둘 */}
      <div className="box-border flex w-full flex-col gap-2.5 rounded-[20px] bg-[var(--lp-cream)] p-3 lg:hidden">
        <TranscriptCardSm />
        <RailCardSm />
      </div>

      {/* 넓은 매트 — 창 하나.
          `zoom`으로 줄인다. 최대 폭만 줄이면 안쪽 글이 다시 흘러 세로가 같은 비율로 안 줄고,
          `scale`은 레이아웃 상자를 그대로 둬서 아래에 빈 자리가 남는다. `zoom`은 상자까지
          같이 줄어서 가로·세로가 정확히 같은 비율로 작아진다. */}
      <div
        className={`${CONTAINER} box-border hidden rounded-[24px] border border-[var(--lp-rule)] bg-[var(--lp-cream)] p-6 lg:block lg:[zoom:0.92]`}
      >
        <div className="overflow-hidden rounded-[14px] border border-[var(--lp-rule)] bg-[var(--lp-card)] shadow-[0_10px_28px_-6px_#33231a1f]">
          <DesktopWindow />
        </div>
      </div>
    </section>
  );
}

/* ── 좁은 화면 ─────────────────────────────────────────────────────────── */

const CARD_SM =
  "box-border rounded-[14px] border border-[var(--lp-rule)] bg-[var(--lp-card)] shadow-[0_2px_8px_#33231a12]";

function TranscriptCardSm() {
  return (
    <div className={`${CARD_SM} overflow-hidden`}>
      <div className="flex items-center gap-2 border-b border-[var(--lp-rule-soft)] px-[13px] py-[11px]">
        <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-[var(--lp-rule-soft)] px-2 py-[3px]">
          <span aria-hidden className="block size-[5px] rounded-full bg-[#8a7a6d]" />
          <span className="text-[9.5px] font-semibold text-[var(--lp-body)]">종료됨</span>
        </span>
        <span className="min-w-0 flex-1 truncate break-keep text-[14px] font-bold text-[var(--lp-ink)]">
          3차 스프린트 킥오프
        </span>
      </div>

      {/* 앱과 같은 밑줄 탭이다 — 알약이 아니다(`note-panel.tsx`의 `TabsList variant="line"`). */}
      <div className="flex items-center gap-4 border-b border-[var(--lp-rule-soft)] px-[13px]">
        {(["정보", "전사", "요약"] as const).map((t) => (
          <span
            key={t}
            className={`flex h-8 items-center border-b-2 text-[10.5px] ${
              t === "전사"
                ? "border-[var(--lp-ink)] font-semibold text-[var(--lp-ink)]"
                : "border-transparent font-medium text-[#8a7a6d]"
            }`}
          >
            {t}
          </span>
        ))}
        <span className="flex-1" />
        <span className="flex items-center gap-1 rounded-[7px] border border-[var(--lp-rule)] px-[9px] py-1">
          <Copy aria-hidden className="size-2.5 text-[#8a7a6d]" />
          <span className="text-[9.5px] font-medium text-[var(--lp-body)]">복사</span>
        </span>
      </div>

      <ul className="m-0 list-none px-[13px] pt-2.5 pb-[13px]">
        {TRANSCRIPT_SM.map((l) => (
          <li
            key={l.at}
            className="grid grid-cols-[34px_1fr] gap-2.5 border-b border-[var(--lp-rule-soft)] py-2.5 last:border-b-0"
          >
            <span className="font-mono text-[9.5px] tabular-nums text-[var(--lp-faint)]">
              {l.at}
            </span>
            <div className="min-w-0">
              <span className="inline-flex items-center gap-1.5 text-[10px] font-medium text-[var(--lp-muted)]">
                <span
                  aria-hidden
                  style={{ background: SPEAKER_TINT[l.who] }}
                  className="flex size-[15px] shrink-0 items-center justify-center rounded-full text-[8px] font-semibold text-white"
                >
                  {l.who.slice(0, 1)}
                </span>
                {l.who}
              </span>
              <p className="m-0 mt-0.5 break-keep text-[11.5px] leading-[1.65] text-[var(--lp-ink)]">
                {l.text}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function RailCardSm() {
  return (
    <div className={`${CARD_SM} px-[13px] pt-3 pb-[13px]`}>
      <div className="flex items-center gap-1 border-b border-[var(--lp-rule-soft)] pb-2.5">
        {(["실시간 정리", "내 에이전트"] as const).map((t) => (
          <span
            key={t}
            className={`px-2.5 py-1 text-[10.5px] ${
              t === "실시간 정리"
                ? "rounded-[7px] bg-[var(--lp-rule-soft)] font-semibold text-[var(--lp-ink)]"
                : "font-medium text-[#8a7a6d]"
            }`}
          >
            {t}
          </span>
        ))}
      </div>

      <div className="flex items-center gap-[7px] pt-[11px]">
        <Bot aria-hidden className="size-[13px] shrink-0 text-[var(--lp-accent)]" />
        <span className="text-[14px] font-semibold tracking-[-0.3px] text-[var(--lp-ink)]">사건 흐름</span>
        <span className="flex-1" />
        <span className="text-[10px] text-[#8a7a6d]">지금까지</span>
        <span className="font-mono text-[10px] font-semibold tabular-nums text-[var(--lp-accent)]">
          5건
        </span>
      </div>
      <p className="m-0 mt-1.5 break-keep text-[10.5px] leading-[1.5] text-[#8a7a6d]">
        이 회의에서 남길 만한 변화만 기록했습니다.
      </p>

      <div className="mt-[11px] flex flex-wrap items-center gap-[5px]">
        {FILTERS.map(([label, n, on]) => (
          <span
            key={label}
            className={`flex items-center gap-1 rounded-full px-[9px] py-1 ${
              on
                ? "bg-[var(--lp-dark)]"
                : "border border-[var(--lp-rule)] bg-[var(--lp-canvas)]"
            }`}
          >
            <span
              className={`text-[9.5px] ${on ? "font-semibold text-[var(--lp-on-dark)]" : "font-medium text-[var(--lp-body)]"}`}
            >
              {label}
            </span>
            <span
              className={`font-mono text-[9.5px] font-semibold tabular-nums ${on ? "text-[var(--lp-on-dark-soft)]" : "text-[var(--lp-faint)]"}`}
            >
              {n}
            </span>
          </span>
        ))}
      </div>

      {GROUPS.map(({ kind, count, icon: Icon, items }) => (
        <div key={kind}>
          <div className="mt-3.5 flex items-center gap-2">
            <Icon aria-hidden className="size-[13px] shrink-0 text-[#8a7a6d]" />
            <span className="text-[11px] font-semibold text-[var(--lp-body)]">{kind}</span>
            <span aria-hidden className="block h-px flex-1 bg-[var(--lp-rule)]" />
            <span className="font-mono text-[10px] font-semibold tabular-nums text-[var(--lp-faint)]">
              {count}
            </span>
            <ChevronDown aria-hidden className="size-[13px] shrink-0 text-[var(--lp-faint)]" />
          </div>
          <ul className="m-0 mt-[9px] list-none p-0">
            {items.map((it, i) => (
              <li
                key={it.title}
                className={`flex gap-2.5 rounded-[10px] border border-[var(--lp-rule)] bg-[var(--lp-card)] px-3 py-2.5 shadow-[0_1px_2px_#33231a10] ${i > 0 ? "mt-[7px]" : ""}`}
              >
                <span
                  aria-hidden
                  className="flex size-[22px] shrink-0 items-center justify-center rounded-lg border border-[var(--lp-rule)] bg-[var(--lp-canvas)]"
                >
                  <Icon className="size-3 text-[var(--lp-body)]" />
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
                  <div className="flex gap-2">
                    <p className="m-0 min-w-0 flex-1 break-keep text-[11px] font-medium leading-[1.45] tracking-[-0.1px] text-[var(--lp-ink)]">
                      {it.title}
                    </p>
                    <span className="flex shrink-0 items-center gap-[5px] pt-px">
                      <span className="font-mono text-[9.5px] tabular-nums text-[var(--lp-faint)]">
                        {it.at}
                      </span>
                      <span className="font-mono text-[9.5px] tabular-nums text-[#8a7a6d]">
                        +{it.more}
                      </span>
                    </span>
                  </div>
                  {it.metaSm ? (
                    <p className="m-0 text-[10px] text-[#8a7a6d]">{it.metaSm}</p>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

/* ── 넓은 화면 ─────────────────────────────────────────────────────────── */

/**
 * 실제 앱은 **상단바가 전사 기둥 안에 산다.** 창 전체를 가로지르지 않는다 —
 * `note-panel.tsx`의 `h-14` 바가 노트 패널의 크롬이고, 레일은 제 헤더를 따로 이고 옆에 선다.
 * 세로 선은 두 기둥을 위에서 아래까지 가른다.
 *
 * 탭도 알약이 아니라 **밑줄**이다(`TabsList variant="line"`). 레일 탭만 알약이다.
 */
function DesktopWindow() {
  return (
    <div className="flex items-stretch">
      <div className="flex min-w-0 flex-1 flex-col">
        <NoteTopbar />
        <Transcript />
      </div>
      <Rail />
    </div>
  );
}

const NOTE_TABS = ["정보", "전사", "요약"] as const;

function NoteTopbar() {
  return (
    <div className="flex h-14 shrink-0 items-center gap-3 border-b border-[var(--lp-rule-soft)] px-4">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <ChevronLeft aria-hidden className="size-[17px] shrink-0 text-[var(--lp-body)]" />
        <Minimize2 aria-hidden className="size-[15px] shrink-0 text-[var(--lp-faint)]" />
        <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-[var(--lp-rule-soft)] px-[9px] py-1">
          <span aria-hidden className="block size-1.5 shrink-0 rounded-full bg-[#8a7a6d]" />
          <span className="text-[11px] font-semibold text-[var(--lp-body)]">종료됨</span>
        </span>
        <span className="truncate break-keep text-[14px] font-semibold text-[var(--lp-ink)]">
          3차 스프린트 킥오프
        </span>
      </div>

      {/* 밑줄 탭. 활성만 2px 밑줄을 갖고, 바 높이를 꽉 채워 밑줄이 바닥선에 붙는다. */}
      <div className="flex h-14 shrink-0 items-center gap-5">
        {NOTE_TABS.map((t) => (
          <span
            key={t}
            className={`flex h-14 items-center border-b-2 text-[13px] ${
              t === "전사"
                ? "border-[var(--lp-ink)] font-semibold text-[var(--lp-ink)]"
                : "border-transparent font-medium text-[#8a7a6d]"
            }`}
          >
            {t}
          </span>
        ))}
      </div>
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-[var(--lp-rule)]">
        <MoreHorizontal aria-hidden className="size-4 text-[#8a7a6d]" />
      </span>
    </div>
  );
}

/**
 * 전사 줄은 **두 칸 격자**다 — 왼쪽에 시각, 오른쪽에 화자 한 줄과 그 아래 본문
 * (`note-archive.tsx`의 `grid-cols-[66px_1fr]`). 화자 이름을 본문 옆에 세우지 않는다.
 *
 * 크기는 앱의 0.85배다. 실제 값(본문 15/28)을 그대로 쓰면 여덟 줄이 창 높이를 넘는다.
 */
function Transcript() {
  return (
    <div className="flex min-w-0 flex-1 flex-col px-5 pt-4 pb-5">
      <div className="flex justify-end">
        <span className="flex items-center gap-1.5 rounded-lg border border-[var(--lp-rule)] px-2.5 py-[5px]">
          <Copy aria-hidden className="size-3 text-[#8a7a6d]" />
          <span className="text-[11px] font-medium text-[var(--lp-body)]">복사</span>
        </span>
      </div>
      <ul className="m-0 mt-1 list-none p-0">
        {TRANSCRIPT.map((l) => (
          <li
            key={l.at}
            className="grid grid-cols-[56px_1fr] gap-5 border-b border-[var(--lp-rule-soft)] py-3.5"
          >
            <span className="pt-0.5 font-mono text-[10px] tabular-nums text-[var(--lp-faint)]">
              {l.at}
            </span>
            <div className="min-w-0">
              <span className="inline-flex items-center gap-1.5 text-[11.5px] font-medium text-[var(--lp-muted)]">
                <span
                  aria-hidden
                  style={{ background: SPEAKER_TINT[l.who] }}
                  className="flex size-[17px] shrink-0 items-center justify-center rounded-full text-[9px] font-semibold text-white"
                >
                  {l.who.slice(0, 1)}
                </span>
                {l.who}
              </span>
              <p className="m-0 mt-0.5 break-keep text-[13px] leading-[1.75] text-[var(--lp-ink)]">
                {l.text}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

const RAIL_TABS = ["실시간 정리", "내 에이전트"] as const;

function Rail() {
  return (
    <div className="box-border flex w-[360px] shrink-0 flex-col border-l border-[var(--lp-rule-soft)] bg-[var(--lp-canvas)]">
      {/* 레일 헤더도 h-14 — 상단바와 바닥선이 맞아야 두 기둥이 한 창으로 읽힌다. */}
      <div className="flex h-14 shrink-0 items-center gap-1 border-b border-[var(--lp-rule-soft)] px-3">
        {RAIL_TABS.map((t) => (
          <span
            key={t}
            className={`inline-flex h-8 items-center rounded-lg px-2.5 text-[11.5px] ${
              t === "실시간 정리"
                ? "bg-[var(--lp-rule-soft)] font-semibold text-[var(--lp-ink)]"
                : "text-[var(--lp-body)]"
            }`}
          >
            {t}
          </span>
        ))}
      </div>

      <div className="flex flex-col gap-[18px] px-4 pt-[22px] pb-5">
        <div className="flex items-center gap-2.5">
          <span className="text-[17px] font-semibold leading-none tracking-[-0.3px] text-[var(--lp-ink)]">
            사건 흐름
          </span>
          <span className="ml-auto shrink-0 rounded-full border border-[var(--lp-rule)] bg-[var(--lp-card)] px-[9px] py-[3px] text-[10.5px] tabular-nums text-[var(--lp-muted)]">
            지금까지 5건
          </span>
        </div>

        <p className="m-0 -mt-2 break-keep text-[11.5px] leading-[1.5] text-[#8a7a6d]">
          이 회의에서 남길 만한 변화만 기록했습니다.
        </p>

        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map(([label, n, on]) => (
            <span
              key={label}
              className={`flex shrink-0 items-center gap-[5px] rounded-full px-[11px] py-1.5 text-[11.5px] ${
                on
                  ? "bg-[var(--lp-dark)] font-semibold text-[var(--lp-on-dark)] shadow-[0_1px_3px_#33231a18]"
                  : "border border-[var(--lp-rule)] font-medium text-[var(--lp-muted)]"
              }`}
            >
              {label}
              <span
                className={`font-mono text-[10.5px] tabular-nums ${on ? "text-[var(--lp-on-dark-soft)]" : "text-[var(--lp-faint)]"}`}
              >
                {n}
              </span>
            </span>
          ))}
        </div>

        {GROUPS.map(({ kind, count, icon: Icon, items }) => (
          <div key={kind} className="flex flex-col gap-[9px]">
            <div className="flex items-center gap-[9px] px-0.5">
              <Icon aria-hidden className="size-[15px] shrink-0 text-[var(--lp-body)]" />
              <span className="text-[13px] font-semibold text-[var(--lp-ink)]">{kind}</span>
              <span aria-hidden className="block h-px min-w-0 flex-1 bg-[var(--lp-rule)]" />
              <span className="shrink-0 font-mono text-[10.5px] tabular-nums text-[var(--lp-faint)]">
                {count}
              </span>
              <ChevronDown aria-hidden className="size-3.5 shrink-0 text-[var(--lp-faint)]" />
            </div>
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
              {items.map((it) => (
                <li
                  key={it.title}
                  className="flex gap-[11px] rounded-xl border border-[var(--lp-rule)] bg-[var(--lp-card)] px-3.5 py-[13px] shadow-[0_1px_2px_#33231a10]"
                >
                  <span
                    aria-hidden
                    className="flex size-[26px] shrink-0 items-center justify-center rounded-lg border border-[var(--lp-rule)] bg-[var(--lp-canvas)]"
                  >
                    <Icon className="size-3.5 text-[var(--lp-body)]" />
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <div className="flex items-start gap-2.5">
                      <p className="m-0 min-w-0 flex-1 break-keep text-[12.5px] leading-[1.45] font-medium tracking-[-0.1px] text-[var(--lp-ink)]">
                        {it.title}
                      </p>
                      <span className="flex shrink-0 items-center gap-1.5 pt-px">
                        <span className="font-mono text-[10px] tabular-nums text-[var(--lp-faint)]">
                          {it.at}
                        </span>
                        <span className="font-mono text-[10px] tabular-nums text-[#8a7a6d]">
                          +{it.more}
                        </span>
                        <ChevronDown aria-hidden className="size-3 text-[var(--lp-faint)]" />
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
