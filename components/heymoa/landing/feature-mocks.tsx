import { ArrowUp, ChevronDown, CircleCheck, Copy, PencilLine, Sparkles } from "lucide-react";

import { SPEAKER_TINT } from "@/components/heymoa/landing/shell";

/**
 * 「기능 소개」 카드 여섯이 저마다 품는 앱 화면 조각.
 *
 * **시안이 아니라 실제 앱을 따른다.** 이 랜딩의 전제가 「사실 대조판」이라, 목업이 앱과
 * 어긋나면 목업이 틀린 것이다. 제품 샷과 같은 해부를 카드 크기로 줄여 그린다 —
 * 전사는 두 칸 격자, 레일은 아이콘 상자를 단 카드, 요약은 세리프 제목과 근거 마커,
 * 챗은 오른쪽 정렬 말풍선이다.
 *
 * **승인 카드가 가장 많이 틀렸었다.** 앱은 도구 id(`linear.create_issue`)를 제목으로
 * 쓰지 않는다 — 그 자리에는 사람 말 요약이 들어가고, 「쓰기 도구」 배지는 요약 **오른쪽**에
 * 선다(`chat-thread.tsx`의 `ApprovalPrompt`). 인자는 그 아래 `dl`로 붙는다.
 *
 * **여기 글자는 전부 삽화다.** `--lp-faint`(2.2:1)를 쓰는 것은 앱 화면의 흐린 보조
 * 텍스트를 따라 그리기 때문이고, 페이지가 직접 하는 말이 아니다.
 */

/** 창의 안쪽 여백. 여섯이 모두 같다 — 앱의 노트 패널이 그렇다. */
const WINDOW = "flex h-full flex-col px-3 py-[11px]";

/** 실시간 전사 — 전사 패널. 두 칸 격자에 시각과 (화자 한 줄 + 본문). */
export function TranscriptPane() {
  const lines: Array<[string, string, string]> = [
    ["00:31", "이서연", "저는 이번에 합류해서 그 맥락을 모릅니다."],
    ["00:44", "김민서", "에이전트가 근거를 붙여 뒀어요. 오른쪽에서 펼치면 됩니다."],
    ["01:02", "정우재", "온보딩 이탈 로그 수집은 제가 맡겠습니다."],
  ];
  return (
    <div className={WINDOW}>
      <div className="flex justify-end">
        <span className="flex items-center gap-1 rounded-md border border-[var(--lp-rule)] px-2 py-[3px]">
          <Copy aria-hidden className="size-2.5 text-[#8a7a6d]" />
          <span className="text-[9.5px] font-medium text-[var(--lp-body)]">복사</span>
        </span>
      </div>
      <ul className="m-0 mt-1 list-none p-0">
        {lines.map(([at, who, text], i) => (
          <li
            key={at}
            className="grid grid-cols-[38px_1fr] gap-3 border-b border-[var(--lp-rule-soft)] py-2.5"
            data-stagger style={{ "--i": i } as React.CSSProperties}
          >
            <span className="pt-px font-mono text-[9.5px] tabular-nums text-[var(--lp-faint)]">
              {at}
            </span>
            <div className="min-w-0">
              <span className="inline-flex items-center gap-1.5 text-[10px] font-medium text-[var(--lp-muted)]">
                <span
                  aria-hidden
                  style={{ background: SPEAKER_TINT[who] }}
                  className="flex size-[15px] shrink-0 items-center justify-center rounded-full text-[8px] font-semibold text-white"
                >
                  {who.slice(0, 1)}
                </span>
                {who}
              </span>
              <p className="m-0 mt-0.5 break-keep text-[11px] leading-[1.6] text-[var(--lp-ink)]">
                {text}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * 실시간 정리 — 오른쪽 레일의 사건 흐름.
 *
 * 뒤집힌 항목이 취소선 + 「철회됨」으로 남는 것이 이 화면의 요점이라 두 번째 카드를 그렇게 둔다.
 */
export function RailFlow() {
  const filters: Array<[string, string, boolean]> = [
    ["전체", "5", true],
    ["결론", "2", false],
    ["논의 중", "2", false],
    ["참고", "1", false],
  ];
  const cards: Array<[string, string, string, boolean]> = [
    ["결제 화면 개편은 다음 스프린트로 미룬다", "+3", "결정 · 내용 보강", false],
    ["결제 화면을 이번 스프린트에 넣는다", "+1", "결정 · 철회됨", true],
  ];
  return (
    <div className={WINDOW}>
      <div className="flex items-center gap-2 border-b border-[var(--lp-rule-soft)] pb-2">
        <span className="text-[12px] font-semibold tracking-[-0.3px] text-[var(--lp-ink)]">
          사건 흐름
        </span>
        <span className="ml-auto shrink-0 rounded-full border border-[var(--lp-rule)] bg-[var(--lp-card)] px-2 py-px text-[9.5px] tabular-nums text-[var(--lp-muted)]">
          지금까지 5건
        </span>
      </div>

      <div className="flex gap-1 pt-2.5">
        {filters.map(([label, n, on]) => (
          <span
            key={label}
            className={`flex items-center gap-1 rounded-full px-2 py-[3px] ${
              on
                ? "bg-[var(--lp-dark)] shadow-[0_1px_3px_#33231a18]"
                : "border border-[var(--lp-rule)] bg-[var(--lp-canvas)]"
            }`}
          >
            <span
              className={`text-[9px] ${on ? "font-semibold text-[var(--lp-on-dark)]" : "font-medium text-[var(--lp-muted)]"}`}
            >
              {label}
            </span>
            <span
              className={`font-mono text-[9px] tabular-nums ${on ? "text-[var(--lp-on-dark-soft)]" : "text-[var(--lp-faint)]"}`}
            >
              {n}
            </span>
          </span>
        ))}
      </div>

      <div className="flex items-center gap-2 pt-3">
        <CircleCheck aria-hidden className="size-[13px] shrink-0 text-[var(--lp-body)]" />
        <span className="text-[10.5px] font-semibold text-[var(--lp-ink)]">결정</span>
        <span aria-hidden className="block h-px flex-1 bg-[var(--lp-rule)]" />
        <span className="font-mono text-[9.5px] tabular-nums text-[var(--lp-faint)]">2</span>
        <ChevronDown aria-hidden className="size-3 shrink-0 text-[var(--lp-faint)]" />
      </div>

      <ul className="m-0 mt-2 flex list-none flex-col gap-[7px] p-0">
        {cards.map(([title, more, meta, withdrawn], i) => (
          <li
            key={title}
            data-stagger style={{ "--i": i } as React.CSSProperties}
            className={`flex gap-2.5 rounded-[10px] border border-[var(--lp-rule)] px-2.5 py-2 shadow-[0_1px_2px_#33231a10] ${withdrawn ? "bg-[var(--lp-canvas)]" : "bg-[var(--lp-card)]"}`}
          >
            <span
              aria-hidden
              className="flex size-[22px] shrink-0 items-center justify-center rounded-lg border border-[var(--lp-rule)] bg-[var(--lp-canvas)]"
            >
              <CircleCheck className="size-3 text-[var(--lp-body)]" />
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
              <div className="flex gap-2">
                <p
                  className={`m-0 min-w-0 flex-1 break-keep text-[10.5px] font-medium leading-[1.45] tracking-[-0.1px] ${
                    withdrawn
                      ? "text-[var(--lp-muted)] line-through"
                      : "text-[var(--lp-ink)]"
                  }`}
                >
                  {title}
                </p>
                <span className="shrink-0 pt-px font-mono text-[9px] tabular-nums text-[#8a7a6d]">
                  {more}
                </span>
              </div>
              <p className="m-0 text-[9.5px] text-[#8a7a6d]">{meta}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * 회의 중 질의 — 레일 챗의 한 왕복.
 *
 * 질문 말풍선은 **오른쪽**에 붙는다(`chat-thread.tsx`의 `UserBubble`은 `justify-end`다).
 * 답변에는 말풍선이 없다 — 본문 그대로 흐르고 아래에 참고한 회의록 칩이 붙는다.
 */
export function ChatAsk() {
  return (
    <div className={`${WINDOW} gap-2`}>
      <div className="flex justify-end">
        <p className="m-0 max-w-[85%] rounded-xl bg-[var(--lp-rule-soft)] px-2.5 py-1.5">
          <span className="break-keep text-[10.5px] leading-[1.5] text-[var(--lp-ink)]">
            결제 화면 개편은 왜 미뤘나요?
          </span>
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-1.5">
          <Sparkles aria-hidden className="size-3 shrink-0 text-[var(--lp-accent)]" />
          <span className="text-[10px] font-semibold text-[var(--lp-accent)]">HeyMoa</span>
        </div>
        <p className="m-0 break-keep text-[10.5px] leading-[1.65] text-[var(--lp-body)]">
          온보딩 이탈 지표를 먼저 보기로 해서 다음 스프린트로 미뤘습니다. 2차 회의에서
          정해진 결정입니다.
        </p>
        <div className="flex flex-wrap items-center gap-1">
          {["2차 회의", "이번 회의"].map((chip) => (
            <span
              key={chip}
              className="rounded-full bg-[var(--lp-rule-soft)] px-2 py-[3px] text-[9px] font-medium text-[var(--lp-body)]"
            >
              {chip}
            </span>
          ))}
        </div>
      </div>

      <div className="mt-auto flex items-center gap-1.5 rounded-full border border-[var(--lp-rule-strong)] px-2.5 py-1.5">
        <span className="text-[10px] text-[var(--lp-faint)]">이 회의에 대해 물어보기</span>
        <span className="flex-1" />
        <ArrowUp aria-hidden className="size-3 shrink-0 text-[#8a7a6d]" />
      </div>
    </div>
  );
}

/**
 * 자동 정리 — 종료 뒤 요약 탭.
 *
 * 라벨 셋은 `lib/notes/analysis-sections.ts`가 정한 것 그대로이고, 근거 마커는 문장
 * **바로 뒤**에 붙는다(`note-summary.tsx`) — 오른쪽 끝으로 밀면 무엇의 근거인지 안 보인다.
 */
export function SummaryList() {
  const groups: Array<[string, Array<[string, string]>]> = [
    ["개요", [["온보딩 이탈을 이번 스프린트의 첫 기준선으로 잡았습니다.", "00:00"]]],
    [
      "액션 아이템",
      [
        ["온보딩 이탈 로그 수집 초안을 목요일까지 올립니다.", "01:02"],
        ["정리된 업무를 Linear 이슈로 내보냅니다.", "01:19"],
      ],
    ],
    ["결정", [["결제 화면 개편은 다음 스프린트로 미룹니다.", "00:14"]]],
  ];
  return (
    <div className={`${WINDOW} gap-3`}>
      {groups.map(([label, items], gi) => (
        <section key={label} data-stagger style={{ "--i": gi } as React.CSSProperties}>
          <div className="flex items-baseline justify-between gap-3 border-b border-[var(--lp-rule-strong)] pb-1">
            <p className="m-0 font-serif text-[12px] font-light tracking-[-0.025em] text-[var(--lp-ink)]">
              {label}
            </p>
            <span className="font-mono text-[9px] tabular-nums text-[var(--lp-faint)]">
              {items.length}
            </span>
          </div>
          <ul className="m-0 mt-1.5 list-none space-y-1 p-0">
            {items.map(([text, at]) => (
              <li key={text}>
                <p className="m-0 break-keep text-[10px] leading-[1.55] text-[var(--lp-ink)]">
                  {text}{" "}
                  <span className="ml-0.5 inline-flex items-center rounded-full border border-[var(--lp-rule)] bg-[var(--lp-canvas)] px-1 py-px align-middle font-mono text-[8px] tabular-nums text-[var(--lp-muted)]">
                    {at}
                  </span>
                </p>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

/**
 * 도구로 내보내기 — 스레드 안의 승인 카드.
 *
 * **도구 id를 제목으로 안 쓴다.** 앱은 그 자리에 사람 말 요약을 넣고, 「쓰기 도구」 배지는
 * 요약 **오른쪽**에 선다. 인자는 아래 `dl`로 붙는다(`chat-thread.tsx`).
 *
 * **일괄 대기열이 아니다.** 호출 하나마다 뜨는 카드이고 버튼은 「승인」과 「거절」 둘뿐이다.
 */
export function ApprovalThread() {
  return (
    <div className={`${WINDOW} gap-2`}>
      <div className="flex justify-end">
        <p className="m-0 max-w-[85%] rounded-xl bg-[var(--lp-rule-soft)] px-2.5 py-1.5">
          <span className="break-keep text-[10.5px] leading-[1.5] text-[var(--lp-ink)]">
            온보딩 이탈 로그 수집, Linear 이슈로 만들어 줘
          </span>
        </p>
      </div>

      <div className="rounded-xl border border-[var(--lp-rule)] bg-[var(--lp-card)] p-2.5">
        <div className="flex items-start justify-between gap-2">
          <p className="m-0 min-w-0 flex-1 break-keep text-[10.5px] leading-[1.5] text-[var(--lp-ink)]">
            Linear 이슈 「온보딩 이탈 로그 수집 초안」 생성
          </p>
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[var(--lp-rule-soft)] px-1.5 py-px">
            <PencilLine aria-hidden className="size-2.5 text-[var(--lp-body)]" />
            <span className="text-[8.5px] font-semibold text-[var(--lp-body)]">쓰기 도구</span>
          </span>
        </div>

        <dl className="m-0 mt-2 flex flex-col gap-0.5">
          <div className="flex gap-2">
            <dt className="w-11 shrink-0 font-mono text-[9px] leading-4 font-medium text-[var(--lp-muted)]">
              title
            </dt>
            <dd className="m-0 min-w-0 flex-1 break-keep text-[9.5px] leading-4 text-[var(--lp-body)]">
              온보딩 이탈 로그 수집 초안
            </dd>
          </div>
        </dl>

        <div className="mt-2.5 flex gap-1.5">
          <span className="rounded-lg bg-[var(--lp-accent)] px-3 py-1 text-[10px] font-semibold text-[var(--lp-on-dark)]">
            승인
          </span>
          <span className="rounded-lg border border-[var(--lp-rule-strong)] bg-[var(--lp-card)] px-3 py-1 text-[10px] font-medium text-[var(--lp-body)]">
            거절
          </span>
        </div>
      </div>
    </div>
  );
}

/** 멤버 초대 — 워크스페이스 설정의 멤버 목록. */
export function InviteList() {
  const members: Array<[string, string]> = [
    ["김민서", "관리자"],
    ["박지훈", "멤버"],
    ["이서연", "초대함"],
  ];
  return (
    <div className={WINDOW}>
      <div className="flex items-center gap-2 border-b border-[var(--lp-rule-soft)] pb-2">
        <span className="text-[12px] font-semibold text-[var(--lp-ink)]">멤버</span>
        <span className="ml-auto font-mono text-[9.5px] tabular-nums text-[var(--lp-muted)]">
          3명
        </span>
      </div>

      <div className="flex gap-1.5 pt-2.5">
        <span className="box-border min-w-0 flex-1 rounded-lg border border-[var(--lp-rule)] px-2.5 py-1.5 text-[10px] text-[var(--lp-muted)]">
          seoyeon@example.com
        </span>
        <span className="shrink-0 rounded-lg bg-[var(--lp-dark)] px-2.5 py-1.5 text-[10px] font-semibold text-[var(--lp-on-dark)]">
          초대
        </span>
      </div>

      {members.map(([who, role], i) => (
        <div
          key={who}
          data-stagger style={{ "--i": i } as React.CSSProperties}
          className={`flex items-center gap-2 border-t border-[var(--lp-rule-soft)] py-2 ${i === 0 ? "mt-1.5" : ""}`}
        >
          <span
            aria-hidden
            style={{ background: SPEAKER_TINT[who] }}
            className="flex size-5 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white"
          >
            {who.slice(0, 1)}
          </span>
          <span className="min-w-0 flex-1 text-[10.5px] font-medium text-[var(--lp-ink)]">
            {who}
          </span>
          {role === "관리자" ? (
            <span className="shrink-0 rounded-full bg-[var(--lp-rule-soft)] px-2 py-px text-[9px] font-semibold text-[var(--lp-accent)]">
              {role}
            </span>
          ) : (
            <span className="shrink-0 text-[9px] text-[var(--lp-muted)]">{role}</span>
          )}
        </div>
      ))}
    </div>
  );
}
