import { FileText, Link as LinkIcon, PencilLine, SquareCheckBig } from "lucide-react";
import type { LucideIcon } from "lucide-react";

/**
 * 「작동 방식」 카드 셋 안에 들어가는 작은 앱 화면 조각. 창 높이가 184px로 고정이라
 * `feature-mocks.tsx`(244px)보다 한 단 작게 그린다.
 *
 * **여기 글자는 전부 삽화다.** 8~10px에 `--lp-faint` 같은 흐린 색을 쓰는 것은 앱 화면의
 * 실제 크기와 색을 따라 그리기 때문이고, 페이지가 직접 하는 말이 아니다. 페이지 문장에
 * 이 색·크기를 쓰면 대비를 잃는다 — 두 쓰임을 섞지 않는다.
 *
 * 이 크기에서는 화자 색을 나누지 않는다. 17px 원에 네 가지 색을 칠하면 색만 튀고 누가
 * 누구인지는 어차피 안 읽힌다 — 시안도 여기서는 초록 하나로 통일했다.
 */

function Row({ at, who, text }: { at: string; who: string; text: string }) {
  return (
    <div className="flex gap-2 border-b border-[var(--lp-rule-soft)] py-2">
      <span className="w-7 shrink-0 font-mono text-[9.5px] leading-[1.7] tabular-nums text-[var(--lp-faint)]">
        {at}
      </span>
      <span
        aria-hidden
        className="flex size-[17px] shrink-0 items-center justify-center rounded-full bg-[var(--lp-green)] text-[8.5px] font-semibold text-[var(--lp-on-dark)]"
      >
        {who.slice(0, 1)}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-px">
        <span className="text-[9.5px] font-semibold text-[#8a7a6d]">{who}</span>
        <span className="break-keep text-[10.5px] leading-[1.5] text-[var(--lp-body)]">
          {text}
        </span>
      </div>
    </div>
  );
}

/** 회의 중 — 발화 세 줄. */
export function MiniTranscript() {
  return (
    <div className="flex flex-col">
      <Row at="00:31" who="이서연" text="저는 이번에 합류해서 그 맥락을 모릅니다." />
      <Row at="00:44" who="김민서" text="에이전트가 근거를 붙여 뒀어요." />
      <Row at="01:02" who="정우재" text="로그 수집은 제가 맡겠습니다." />
    </div>
  );
}

/**
 * 회의 직후 — 요약이 셋으로 갈린 모습.
 * 라벨은 `lib/notes/analysis-sections.ts`가 정한 것 그대로다(개요 · 액션 아이템 · 결정).
 */
export function SummarySplit() {
  const rows: Array<[LucideIcon, string, string]> = [
    [FileText, "개요", "온보딩 이탈 지표부터 확인하기로 함"],
    [SquareCheckBig, "액션 아이템", "로그 수집 초안 — 정우재 · 목요일"],
    [LinkIcon, "결정", "결제 화면 개편은 다음 스프린트로"],
  ];
  return (
    <div className="flex flex-col">
      {rows.map(([Icon, label, text]) => (
        <div key={label} className="flex flex-col gap-[5px] pt-[7px] pb-[9px]">
          <div className="flex items-center gap-1.5">
            <Icon aria-hidden className="size-3 shrink-0 text-[var(--lp-accent)]" />
            <span className="text-[10px] font-semibold text-[var(--lp-ink)]">{label}</span>
          </div>
          <p className="m-0 break-keep text-[10.5px] leading-[1.45] text-[var(--lp-body)]">
            {text}
          </p>
        </div>
      ))}
    </div>
  );
}

/**
 * 그 다음 — 승인 카드.
 *
 * **일괄 대기열이 아니다.** 스레드 안에서 호출 하나마다 뜨는 카드이고 버튼은 「승인」과
 * 「거절」 둘뿐이다(`chat-thread.tsx`의 `ApprovalPrompt`). 「보류」나 체크박스로 여러 건을
 * 골라 내보내는 화면은 코드에 없다.
 */
export function ApprovalCard() {
  return (
    <div className="flex h-full flex-col">
      <span className="inline-flex items-center gap-1 self-start rounded-full bg-[var(--lp-rule-soft)] px-2 py-[3px]">
        <PencilLine aria-hidden className="size-2.5 shrink-0 text-[var(--lp-body)]" />
        <span className="text-[9px] font-semibold text-[var(--lp-body)]">쓰기 도구</span>
      </span>
      <p className="m-0 mt-[9px] break-keep text-[11.5px] font-semibold leading-[1.45] text-[var(--lp-ink)]">
        Linear 에 이슈를 만들까요?
      </p>
      <div className="mt-2 box-border flex flex-col gap-[3px] rounded-lg border border-[var(--lp-rule)] bg-[var(--lp-canvas)] px-[9px] py-[7px]">
        <span className="font-mono text-[9px] text-[var(--lp-muted)]">linear.create_issue</span>
        <span className="break-keep text-[10px] leading-[1.4] text-[var(--lp-body)]">
          온보딩 이탈 로그 수집 초안 올리기
        </span>
      </div>
      {/* 버튼을 창 바닥에 붙인다 — 세 카드의 창 높이가 같아서 바닥선이 맞아야 줄이 선다. */}
      <div className="mt-auto flex items-center gap-1.5 pt-3">
        <span className="flex items-center justify-center rounded-[7px] bg-[var(--lp-accent)] px-3 py-1.5 text-[10px] font-semibold text-[var(--lp-on-dark)]">
          승인
        </span>
        <span className="flex items-center justify-center rounded-[7px] border border-[var(--lp-rule-strong)] bg-[var(--lp-card)] px-3 py-1.5 text-[10px] font-medium text-[var(--lp-body)]">
          거절
        </span>
      </div>
    </div>
  );
}
