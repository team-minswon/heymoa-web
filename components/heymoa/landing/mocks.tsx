import { FileText, Link as LinkIcon, PencilLine, SquareCheckBig } from "lucide-react";
import type { LucideIcon } from "lucide-react";

/**
 * 「작동 방식」 카드 셋 안에 들어가는 작은 앱 화면 조각. 넓은 화면에서는 창 높이가 184px로
 * 고정이라 `feature-mocks.tsx`(내용만큼 자람)보다 한 단 작게 그린다.
 *
 * **좁은 화면은 시안이 다시 그렸다.** 전사는 구분선 대신 8px 간격, 요약은 항목마다 가는
 * 선 하나, 승인 카드는 바닥 붙이기를 안 한다(창이 자라므로 붙일 바닥이 없다). 글자도
 * 한 단 크다 — 350px 카드에서 10px는 안 읽힌다.
 *
 * **여기 글자는 전부 삽화다.** 8~11px에 `--lp-faint` 같은 흐린 색을 쓰는 것은 앱 화면의
 * 실제 크기와 색을 따라 그리기 때문이고, 페이지가 직접 하는 말이 아니다. 페이지 문장에
 * 이 색·크기를 쓰면 대비를 잃는다 — 두 쓰임을 섞지 않는다.
 *
 * 이 크기에서는 화자 색을 나누지 않는다. 17px 원에 네 가지 색을 칠하면 색만 튀고 누가
 * 누구인지는 어차피 안 읽힌다 — 시안도 여기서는 한 색으로 통일했다.
 */

function Row({ at, who, text }: { at: string; who: string; text: string }) {
  return (
    <div className="flex gap-2 lg:border-b lg:border-[var(--lp-rule-soft)] lg:py-2">
      <span className="w-7 shrink-0 font-mono text-[9.5px] leading-[1.7] tabular-nums text-[var(--lp-faint)]">
        {at}
      </span>
      <span
        aria-hidden
        className="flex size-4 shrink-0 items-center justify-center rounded-full bg-[var(--lp-rule-soft)] text-[8px] font-semibold text-[var(--lp-body)] lg:size-[17px] lg:bg-[var(--lp-green)] lg:text-[8.5px] lg:text-[var(--lp-on-dark)]"
      >
        {who.slice(0, 1)}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-px">
        <span className="text-[9px] font-semibold text-[#8a7a6d] lg:text-[9.5px]">{who}</span>
        <span className="break-keep text-[11px] leading-[1.55] text-[var(--lp-ink)] lg:text-[10.5px] lg:leading-[1.5] lg:text-[var(--lp-body)]">
          {text}
        </span>
      </div>
    </div>
  );
}

/** 회의 중 — 발화 세 줄. */
export function MiniTranscript() {
  return (
    <div className="flex flex-col gap-2 lg:gap-0">
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
    <div className="flex flex-col gap-[9px] lg:gap-0">
      {rows.map(([Icon, label, text], i) => (
        <div key={label} className="contents">
          {i > 0 ? (
            <span aria-hidden className="block h-px bg-[var(--lp-rule-soft)] lg:hidden" />
          ) : null}
          <div className="flex flex-col gap-[3px] lg:gap-[5px] lg:pt-[7px] lg:pb-[9px]">
            <div className="flex items-center gap-1.5">
              <Icon aria-hidden className="hidden size-3 shrink-0 text-[var(--lp-accent)] lg:block" />
              <span className="font-serif text-[10px] font-semibold text-[#8a7a6d] lg:text-[var(--lp-ink)]">
                {label}
              </span>
            </div>
            <p className="m-0 break-keep text-[11px] leading-[1.55] text-[var(--lp-ink)] lg:text-[10.5px] lg:leading-[1.45] lg:text-[var(--lp-body)]">
              {text}
            </p>
          </div>
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
    <div className="flex flex-col lg:h-full">
      <span className="inline-flex items-center gap-[5px] self-start rounded-full bg-[var(--lp-rule-soft)] px-2 py-[3px] lg:gap-1">
        <PencilLine aria-hidden className="size-2.5 shrink-0 text-[var(--lp-body)]" />
        <span className="text-[9.5px] font-semibold text-[var(--lp-body)] lg:text-[9px]">
          쓰기 도구
        </span>
      </span>
      <p className="m-0 mt-[9px] break-keep text-[12px] font-bold leading-[1.45] text-[var(--lp-ink)] lg:text-[11.5px] lg:font-semibold">
        Linear 에 이슈를 만들까요?
      </p>
      <div className="mt-2 box-border flex flex-col gap-1 rounded-lg border border-[var(--lp-rule)] bg-[var(--lp-canvas)] px-2.5 py-2 lg:gap-[3px] lg:px-[9px] lg:py-[7px]">
        <span className="font-mono text-[9.5px] text-[var(--lp-muted)] lg:text-[9px]">
          linear.create_issue
        </span>
        <span className="break-keep text-[10.5px] leading-[1.45] text-[var(--lp-body)] lg:text-[10px] lg:leading-[1.4]">
          온보딩 이탈 로그 수집 초안 올리기
        </span>
      </div>
      {/* 넓은 화면에서만 버튼을 창 바닥에 붙인다 — 거기서는 세 창의 높이가 184px로 같아서
          바닥선이 맞아야 줄이 선다. 좁은 화면의 창은 내용만큼 자라므로 붙일 바닥이 없다. */}
      <div className="mt-[11px] flex items-center gap-[7px] lg:mt-auto lg:gap-1.5 lg:pt-3">
        <span className="rounded-lg bg-[var(--lp-dark)] px-3.5 py-[7px] text-[11px] font-semibold text-[var(--lp-on-dark)] lg:rounded-[7px] lg:bg-[var(--lp-accent)] lg:px-3 lg:py-1.5 lg:text-[10px]">
          승인
        </span>
        <span className="rounded-lg border border-[var(--lp-rule-strong)] bg-[var(--lp-card)] px-3.5 py-[7px] text-[11px] font-medium text-[var(--lp-body)] lg:rounded-[7px] lg:px-3 lg:py-1.5 lg:text-[10px]">
          거절
        </span>
      </div>
    </div>
  );
}
