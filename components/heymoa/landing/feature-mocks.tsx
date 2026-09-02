import { ArrowUp, ChevronDown, Copy, PencilLine, Sparkles } from "lucide-react";

/**
 * 「기능 소개」 카드 여섯 개가 저마다 품는 앱 화면 조각.
 *
 * **`mocks.tsx`와 크기가 다르다.** 저쪽은 「작동 방식」의 작은 카드용이라 9~10px로 줄여
 * 그렸고, 여기는 244px 창이라 앱의 실제 크기(11~12px)에 가깝다. 같은 화면을 두 배율로
 * 그리는 것이라 한쪽으로 합치면 어느 한쪽이 뭉개진다.
 *
 * 여기 글자도 전부 삽화다 — `--lp-faint`(2.2:1)를 쓰는 것은 앱 화면의 흐린 보조 텍스트를
 * 따라 그리기 때문이고, 페이지가 직접 하는 말이 아니다.
 */

const AVATAR: Record<string, string> = {
  김민서: "#366c4f",
  박지훈: "#8a5a3c",
  이서연: "#3d5a80",
  정우재: "#7a4a63",
};

function Avatar({ who, className = "size-[18px]" }: { who: string; className?: string }) {
  return (
    <span
      aria-hidden
      style={{ background: AVATAR[who] }}
      className={`flex shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white ${className}`}
    >
      {who.slice(0, 1)}
    </span>
  );
}

/** 실시간 전사 — 전사 패널. */
export function TranscriptPane() {
  const lines: Array<[string, string, string]> = [
    ["00:31", "이서연", "저는 이번에 합류해서 그 맥락을 모릅니다."],
    ["00:44", "김민서", "에이전트가 근거를 붙여 뒀어요. 오른쪽에서 펼치면 됩니다."],
    ["01:02", "정우재", "온보딩 이탈 로그 수집은 제가 맡겠습니다."],
  ];
  return (
    <div className="flex h-full flex-col px-3 pt-2.5 pb-1">
      <div className="flex items-center justify-between pb-2">
        <span className="text-[11px] font-semibold text-[#8a7a6d]">전사</span>
        <span className="flex items-center gap-1 rounded-md border border-[var(--lp-rule)] px-2 py-[3px]">
          <Copy aria-hidden className="size-2.5 text-[#8a7a6d]" />
          <span className="text-[10px] font-medium text-[var(--lp-body)]">복사</span>
        </span>
      </div>
      <ul className="m-0 list-none p-0">
        {lines.map(([at, who, text]) => (
          <li key={at} className="flex gap-[9px] border-t border-[var(--lp-rule-soft)] py-2.5">
            <span className="w-[34px] shrink-0 font-mono text-[10px] leading-[1.7] tabular-nums text-[var(--lp-faint)]">
              {at}
            </span>
            <Avatar who={who} />
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="text-[10.5px] font-semibold text-[var(--lp-ink)]">{who}</span>
              <span className="break-keep text-[11.5px] leading-[1.6] text-[var(--lp-body)]">
                {text}
              </span>
            </span>
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
  return (
    <div className="flex h-full flex-col p-3">
      <div className="flex items-center gap-2 border-b border-[var(--lp-rule-soft)] pb-[9px]">
        <span className="text-[11.5px] font-bold text-[var(--lp-ink)]">사건 흐름</span>
        <span className="flex-1" />
        <span className="hidden text-[10px] text-[var(--lp-muted)] lg:inline">지금까지</span>
        <span className="font-mono text-[10px] font-semibold tabular-nums text-[var(--lp-accent)]">
          5건
        </span>
      </div>

      <div className="flex gap-[5px] pt-2.5">
        {filters.map(([label, n, on]) => (
          <span
            key={label}
            className={`flex items-center gap-1 rounded-full px-2 py-[3px] ${
              on
                ? "bg-[var(--lp-dark)]"
                : "border border-[var(--lp-rule)] bg-[var(--lp-canvas)]"
            }`}
          >
            <span
              className={`text-[9px] ${on ? "font-semibold text-[var(--lp-on-dark)]" : "font-medium text-[var(--lp-body)]"}`}
            >
              {label}
            </span>
            <span
              className={`font-mono text-[9px] font-semibold tabular-nums ${on ? "text-[var(--lp-on-dark-soft)]" : "text-[var(--lp-muted)]"}`}
            >
              {n}
            </span>
          </span>
        ))}
      </div>

      <div className="flex items-center gap-2 pt-[13px]">
        <span className="text-[10.5px] font-semibold text-[var(--lp-body)]">결정</span>
        <span aria-hidden className="block h-px flex-1 bg-[var(--lp-rule)]" />
        <span className="font-mono text-[9.5px] font-semibold tabular-nums text-[var(--lp-muted)]">
          2
        </span>
      </div>

      <div className="mt-[9px] rounded-[9px] border border-[var(--lp-rule)] bg-[var(--lp-card)] p-2.5">
        <div className="flex gap-2">
          <span className="min-w-0 flex-1 break-keep text-[11px] font-semibold leading-[1.45] text-[var(--lp-ink)]">
            결제 화면 개편은 다음 스프린트로 미룬다
          </span>
          <span className="shrink-0 font-mono text-[9.5px] font-semibold tabular-nums text-[var(--lp-muted)]">
            +3
          </span>
        </div>
        <span className="mt-1 block text-[10px] text-[var(--lp-muted)]">내용 보강</span>
      </div>

      <div className="mt-[7px] rounded-[9px] border border-[var(--lp-rule)] bg-[var(--lp-canvas)] p-2.5">
        <div className="flex gap-2">
          <span className="min-w-0 flex-1 break-keep text-[11px] font-semibold leading-[1.45] text-[var(--lp-muted)] line-through">
            결제 화면을 이번 스프린트에 넣는다
          </span>
          <span className="shrink-0 font-mono text-[9.5px] font-semibold tabular-nums text-[var(--lp-muted)]">
            +1
          </span>
        </div>
        <span className="mt-1 block text-[10px] text-[var(--lp-muted)]">철회됨</span>
      </div>
    </div>
  );
}

/** 회의 중 질의 — 레일 챗의 한 왕복. 답변 아래 참고한 회의록 칩이 붙는다. */
export function ChatAsk() {
  return (
    <div className="flex h-full flex-col p-3">
      <div className="self-start rounded-[12px_12px_4px_12px] bg-[#f7efe3] px-3 py-[9px]">
        <span className="text-[11.5px] font-medium text-[var(--lp-ink)]">
          결제 화면 개편은 왜 미뤘나요?
        </span>
      </div>

      <div className="mt-2.5 flex flex-col gap-2 rounded-[4px_12px_12px_12px] border border-[var(--lp-rule)] bg-[var(--lp-card)] px-3 py-[11px]">
        <div className="flex items-center gap-1.5">
          <Sparkles aria-hidden className="size-3 shrink-0 text-[var(--lp-accent)]" />
          <span className="text-[10.5px] font-semibold text-[var(--lp-accent)]">HeyMoa</span>
        </div>
        <p className="m-0 break-keep text-[11.5px] leading-[1.65] text-[var(--lp-body)]">
          온보딩 이탈 지표를 먼저 보기로 해서 다음 스프린트로 미뤘습니다. 2차 회의에서
          정해진 결정입니다.
        </p>
        <div className="flex items-center gap-[5px]">
          {["2차 회의", "이번 회의"].map((chip) => (
            <span
              key={chip}
              className="rounded-full bg-[var(--lp-rule-soft)] px-[7px] py-[3px] text-[9.5px] font-medium text-[var(--lp-body)]"
            >
              {chip}
            </span>
          ))}
        </div>
      </div>

      <div className="mt-2.5 flex items-center justify-between rounded-full border border-[var(--lp-rule-strong)] px-2.5 py-2">
        <span className="text-[11px] text-[var(--lp-faint)]">회의 중에 물어보기</span>
        <ArrowUp aria-hidden className="size-3 shrink-0 text-[#8a7a6d]" />
      </div>
    </div>
  );
}

/**
 * 자동 정리 — 종료 뒤 요약 탭.
 * 라벨 셋은 `lib/notes/analysis-sections.ts`가 정한 것 그대로다.
 */
export function SummaryList() {
  const groups: Array<[string, string, Array<[string, string]>]> = [
    [
      "개요",
      "1",
      [["온보딩 이탈을 이번 스프린트의 첫 기준선으로 잡고, 결제 화면 개편은 뒤로 미뤘습니다.", "+3"]],
    ],
    [
      "액션 아이템",
      "2",
      [
        ["온보딩 이탈 로그 수집 초안을 목요일까지 올립니다.", "+2"],
        ["정리된 업무를 Linear 이슈로 내보냅니다.", "+1"],
      ],
    ],
    ["결정", "2", [["결제 화면 개편은 다음 스프린트로 미룹니다.", "+3"]]],
  ];
  return (
    <div className="flex h-full flex-col px-3.5 py-3">
      {groups.map(([label, count, items], gi) => (
        <div key={label} className={gi > 0 ? "mt-4" : ""}>
          <div className="flex items-end justify-between border-b border-[var(--lp-rule-soft)] pb-1.5">
            <p className="m-0 font-serif text-[13px] font-semibold text-[var(--lp-ink)]">
              {label}
            </p>
            <span className="font-mono text-[10px] font-medium tabular-nums text-[var(--lp-faint)]">
              {count}
            </span>
          </div>
          <ul className="m-0 list-none p-0">
            {items.map(([text, more]) => (
              <li key={text} className="flex gap-2 pt-[9px]">
                <span className="min-w-0 flex-1 break-keep text-[11.5px] leading-[1.6] text-[var(--lp-body)]">
                  {text}
                </span>
                <span className="flex shrink-0 items-center gap-[5px] pt-0.5">
                  <span className="font-mono text-[9.5px] font-semibold tabular-nums text-[#8a7a6d]">
                    {more}
                  </span>
                  <ChevronDown aria-hidden className="size-[11px] text-[var(--lp-faint)]" />
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

/**
 * 도구로 내보내기 — 스레드 안의 승인 카드.
 *
 * **일괄 대기열이 아니다.** 호출 하나마다 뜨는 카드이고 버튼은 「승인」과 「거절」 둘뿐이다
 * (`chat-thread.tsx`의 `ApprovalPrompt`).
 */
export function ApprovalThread() {
  return (
    <div className="flex h-full flex-col gap-[9px] px-3.5 py-3">
      <div className="max-w-[76%] self-end rounded-[12px_12px_4px_12px] bg-[var(--lp-rule-soft)] px-[11px] py-2">
        <span className="break-keep text-[11px] leading-[1.5] text-[var(--lp-ink)]">
          온보딩 이탈 로그 수집, Linear 이슈로 만들어 줘
        </span>
      </div>
      <div className="flex flex-col rounded-xl border border-[var(--lp-rule)] bg-[var(--lp-canvas)] px-3 py-[11px]">
        <span className="inline-flex items-center gap-[5px] self-start rounded-full bg-[var(--lp-rule-soft)] px-2 py-[3px]">
          <PencilLine aria-hidden className="size-2.5 shrink-0 text-[var(--lp-body)]" />
          <span className="text-[9.5px] font-semibold text-[var(--lp-body)]">쓰기 도구</span>
        </span>
        <p className="m-0 mt-[9px] break-keep text-[12px] font-bold leading-[1.45] text-[var(--lp-ink)]">
          Linear 에 이슈를 만들까요?
        </p>
        <div className="mt-2 flex flex-col gap-1 rounded-lg border border-[var(--lp-rule)] bg-[var(--lp-card)] px-2.5 py-2">
          <span className="font-mono text-[9.5px] text-[#8a7a6d]">linear.create_issue</span>
          <span className="break-keep text-[10.5px] leading-[1.45] text-[var(--lp-body)]">
            온보딩 이탈 로그 수집 초안 올리기
          </span>
        </div>
        <div className="mt-[11px] flex items-center gap-[7px]">
          <span className="rounded-lg bg-[var(--lp-dark)] px-3.5 py-[7px] text-[11px] font-semibold text-[var(--lp-on-dark)]">
            승인
          </span>
          <span className="rounded-lg border border-[var(--lp-rule-strong)] px-3.5 py-[7px] text-[11px] font-medium text-[var(--lp-body)]">
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
    <div className="flex h-full flex-col p-3">
      <div className="flex items-center gap-2 border-b border-[var(--lp-rule-soft)] pb-[9px]">
        <span className="text-[11.5px] font-bold text-[var(--lp-ink)]">멤버</span>
        <span className="flex-1" />
        <span className="font-mono text-[10px] tabular-nums text-[var(--lp-muted)]">3명</span>
      </div>

      <div className="flex gap-1.5 pt-[11px]">
        <span className="box-border min-w-0 flex-1 rounded-lg border border-[var(--lp-rule)] px-2.5 py-[7px] text-[10.5px] text-[var(--lp-muted)]">
          seoyeon@example.com
        </span>
        <span className="shrink-0 rounded-lg bg-[var(--lp-dark)] px-3 py-[7px] text-[10.5px] font-semibold text-[var(--lp-on-dark)]">
          초대
        </span>
      </div>

      {members.map(([who, role], i) => (
        <div
          key={who}
          className={`flex items-center gap-[9px] border-t border-[var(--lp-rule-soft)] py-[11px] ${i === 0 ? "mt-1.5" : ""}`}
        >
          <Avatar who={who} className="size-5" />
          <span className="min-w-0 flex-1 text-[11px] font-semibold text-[var(--lp-ink)]">
            {who}
          </span>
          {role === "관리자" ? (
            <span className="shrink-0 rounded-full bg-[var(--lp-rule-soft)] px-2 py-[3px] text-[9.5px] font-semibold text-[var(--lp-accent)]">
              {role}
            </span>
          ) : (
            <span className="shrink-0 text-[9.5px] text-[var(--lp-muted)]">{role}</span>
          )}
        </div>
      ))}
    </div>
  );
}
