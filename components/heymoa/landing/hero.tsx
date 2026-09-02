import { LandingCta } from "@/components/heymoa/landing-cta";
import { CONTAINER, SECTION_X } from "@/components/heymoa/landing/shell";

/**
 * 히어로. 아트보드 1440 기준 — 가운데 정렬, h1 76 / 800 / ls -2.4 / lh 1.14.
 *
 * **알약 배지는 없다.** 원본에는 「● 회의에 함께 앉는 AI 에이전트」 알약이 있었는데 초록 점이
 * 아무 상태도 뜻하지 않는 장식이라 뺐다. 빠진 세로 공간만큼 위 여백을 64 → 96으로 올려
 * 제목이 있던 자리를 지킨다.
 *
 * 딸린 문구를 한 문단으로 합치지 않은 것은 원본이 두 줄로 끊어 읽히게 짜여 있어서다 —
 * 첫 줄이 문제, 둘째 줄이 답이다.
 *
 * 주 버튼은 `LandingCta`가 그린다. 시안은 로그인한 화면(「대시보드로 이동 →」)을 그렸지만
 * 비로그인에게는 같은 자리에 로그인 입구가 와야 해서 라벨과 행선지는 그쪽이 정하게 둔다.
 *
 * **위 여백은 상단바 바닥에서부터 잰다.** 아트보드는 정적인 바(76) 아래 96을 두지만 이 앱의
 * 상단바는 `fixed top-4`로 떠 있는 알약이라 자리를 안 먹는다. 그래서 알약 바닥(16+62=78)에
 * 아트보드의 96을 더한 174가 이 면의 값이다 — 킥커가 뷰포트 위에서 174에 서고, 아트보드의
 * 172와 2px 안에서 만난다. 모바일도 같은 셈으로 78+60=138이다.
 *
 * 섹션 높이만 비교하면 아트보드보다 78 크게 나오는데, 그 몫이 정확히 아트보드가 바에게
 * 내준 자리다. 높이가 아니라 킥커의 눈높이로 맞춘다.
 */
export function Hero() {
  return (
    <section
      className={`${SECTION_X} flex flex-col items-center pt-[138px] lg:pt-[174px]`}
    >
      <div className={`${CONTAINER} flex flex-col items-center`}>
        <p className="m-0 text-[15px] font-medium text-[var(--lp-muted)]">
          회의 기록에서 멈추지 않습니다
        </p>

        <h1 className="m-0 mt-[11px] max-w-[350px] text-balance break-keep text-center text-[38px] font-extrabold leading-[1.18] tracking-[-1.3px] text-[var(--lp-ink)] lg:mt-[14px] lg:max-w-[840px] lg:text-[76px] lg:leading-[1.14] lg:tracking-[-2.4px]">
          회의 시간을 새지 않게
        </h1>

        <div className="mt-5 flex max-w-[340px] flex-col items-center gap-[5px] lg:mt-[26px] lg:max-w-[700px] lg:gap-1.5">
          <p className="m-0 break-keep text-center text-[16px] leading-[1.72] text-[var(--lp-body)] lg:text-[17px] lg:leading-[1.7]">
            팀은 계속 바뀝니다. 그때마다 지난 회의의 맥락이 사라지고 같은 논의를
            다시 합니다.
          </p>
          <p className="m-0 break-keep text-center text-[16px] leading-[1.72] text-[var(--lp-body)] lg:text-[17px] lg:leading-[1.7]">
            HeyMoa 는 회의를 기록하는 데서 멈추지 않고{" "}
            <span className="font-bold text-[var(--lp-ink)]">
              전·후 맥락을 이어 붙입니다.
            </span>
          </p>
        </div>

        {/* 모바일은 세로로 쌓아 전폭, 데스크톱은 나란히. 둘 다 pill(h50+)이라 탭 타깃이 넉넉하다. */}
        <div className="mt-[26px] flex w-full max-w-[350px] flex-col gap-[9px] lg:mt-[34px] lg:w-auto lg:max-w-none lg:flex-row lg:items-center lg:gap-3">
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

        <p className="m-0 mt-[15px] text-[13.5px] text-[var(--lp-muted)] lg:mt-[18px] lg:text-[13px]">
          설치할 것 없음 · 신용카드 없음
        </p>
      </div>
    </section>
  );
}
