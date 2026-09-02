import { CalendarCheck } from "lucide-react";

import { LandingCta } from "@/components/heymoa/landing-cta";
import { SECTION_X } from "@/components/heymoa/landing/shell";

/**
 * 닫는 CTA. 시안은 아이콘 · 안내 한 줄 · 큰 제목 · 버튼 둘 · 잔글씨 순서다.
 *
 * 「프로젝트와 회의를 하나씩」이라고 적은 것은 실제로 두 단계라서다 — 워크스페이스만 만들면
 * 「새 노트」를 누를 곳이 없다. 앱의 온보딩 화면도 같은 순서로 안내한다.
 */
export function ClosingCta() {
  return (
    <section className={`${SECTION_X} py-18 lg:py-28`}>
      <div className="mx-auto flex w-full max-w-[760px] flex-col items-center">
        <span className="flex size-[42px] items-center justify-center rounded-[14px] border border-[var(--lp-rule)] bg-[var(--lp-cream)] lg:size-11">
          <CalendarCheck aria-hidden className="size-[21px] text-[var(--lp-accent)]" />
        </span>

        <p className="m-0 mt-[18px] max-w-[320px] break-keep text-center text-[15px] leading-[1.6] font-medium text-[var(--lp-muted)] lg:mt-5 lg:max-w-none lg:leading-normal">
          Google 계정으로 로그인하고 프로젝트와 회의를 하나씩 만들면 끝입니다.
        </p>

        <h2 className="m-0 mt-3 text-balance break-keep text-center text-[34px] font-extrabold leading-[1.2] tracking-[-1.2px] text-[var(--lp-ink)] lg:text-[58px] lg:tracking-[-2px]">
          다음 회의부터.
        </h2>

        <div className="mt-6.5 flex w-full max-w-[350px] flex-col gap-[9px] lg:mt-8 lg:w-auto lg:max-w-none lg:flex-row lg:items-center lg:gap-3">
          <LandingCta
            label="Google 계정으로 시작"
            className="h-[50px] w-full justify-center gap-2 rounded-full border-0 bg-[var(--lp-dark)] px-7 text-[15px] font-semibold text-[var(--lp-on-dark)] hover:bg-[var(--lp-accent)] lg:h-auto lg:w-auto lg:py-[15px]"
          />
          <a
            href="#how-it-works"
            className="flex h-[50px] w-full items-center justify-center rounded-full border border-[var(--lp-rule)] bg-[var(--lp-card)] px-7 text-[15px] font-semibold text-[var(--lp-ink)] transition-colors hover:bg-[var(--lp-cream)] lg:h-auto lg:w-auto lg:py-[15px]"
          >
            작동 방식 보기
          </a>
        </div>

        <p className="m-0 mt-[15px] break-keep text-center text-[13.5px] text-[var(--lp-muted)] lg:mt-[18px] lg:text-[13px]">
          설치할 것 없음 · 신용카드 없음
        </p>
      </div>
    </section>
  );
}
