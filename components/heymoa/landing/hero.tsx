import { useTranslations } from "next-intl";

import { LandingCta } from "@/components/heymoa/landing-cta";
import { cn } from "@/lib/utils";

import { HeroStage } from "./hero-stage";
import { AppDownloadLink } from "./app-download-link";
import { Speech } from "./marks";
import { RICH } from "./rich";
import { CONTAINER, FOCUS, H1, LEAD, MARKER_DRAW, vars } from "./tokens";

/**
 * 첫 화면 셈. 높이는 **브라우저의 보이는 높이**로 잽니다(탭 · 주소창 · 작업표시줄 · Safari 툴바를 뺀 값). 상단 바 64 를
 * 전제로 하고, 창 높이 셈은 `hero-stage.tsx` 의 `WINDOW_H` 입니다.
 *
 * - 1440×900: 상단 바 64 → pt 24 → 머리 ≈ 203 → 무대 mt 32 → 무대 pt 56 → 창 500 ⇒ 창 바닥 ≈ 879
 * - 높이 721~890: 말풍선 위 24 는 두고(줄이면 상단 바 선에 붙습니다) 제목 위를 20 → 8 로 줄여 창 위끝 ≈ 347
 * - 높이 720 이하(1366×650 · 1280×700): 제목 52px, 창 위끝 ≈ 321
 * - 높이 700 이하(390×664 아이폰 Safari): 머리 사이 여백을 줄여 창 위끝 ≈ 452. 대본은 창 위끝에서 64px 이 보이면 돕니다
 * - 높이 600 이하(375×553 SE): 제목 30px · 버튼 44 · 무대 위 띠 48 ⇒ 창 위끝 ≈ 420
 *
 * 700 단과 600 단은 높이 범위로 가릅니다 — 둘 다 `max-height` 면 Tailwind 가 600 단을 먼저 내보내 700 단이 이깁니다.
 */
export function Hero() {
  const t = useTranslations("landing.hero");
  return (
    <section className="overflow-visible pb-14 lg:pb-24">
      <div
        className={cn(
          CONTAINER,
          "relative z-10 pt-6 lg:grid lg:grid-cols-[minmax(0,1fr)_440px] lg:items-end lg:gap-10"
        )}
      >
        <div>
          <div className="flex flex-col items-start gap-1 whitespace-nowrap lg:flex-row lg:flex-wrap lg:items-end lg:gap-3">
            <Speech
              who="minseo"
              tone="butter"
              tilt={-2}
              anim="pop"
              className="tv-orb [--oe:520px] [--or:-6deg] [--ox:-34px] [--oy:-12px]"
            >
              {t("askDuty")}
            </Speech>
            <Speech
              who="jihoon"
              side="right"
              tone="white"
              size="sm"
              tilt={3}
              anim="pop"
              delay={600}
              className="tv-orb -mt-1 ml-16 [--oe:520px] [--or:8deg] [--ox:44px] [--oy:-26px] lg:mt-0 lg:-mb-3 lg:ml-0 lg:[@media(max-height:890px)]:mb-0"
            >
              {t("didLastWeek")}
            </Speech>
          </div>
          <h1
            className={cn(
              H1,
              "mt-3 max-lg:[@media(max-height:600px)]:text-[30px] max-lg:[@media(max-height:700px)]:mt-2 lg:mt-5 lg:text-[52px] lg:[@media(max-height:890px)]:mt-2 xl:text-[64px] xl:[@media(max-height:720px)]:text-[52px]"
            )}
          >
            {t.rich("title", {
              ...RICH,
              mark: (chunks) => (
                <span className={MARKER_DRAW} style={vars({ "--d": "300ms" })}>
                  {chunks}
                </span>
              ),
            })}
          </h1>
        </div>

        <div className="mt-3 max-lg:[@media(max-height:600px)]:mt-1 max-lg:[@media(min-height:601px)_and_(max-height:700px)]:mt-2 lg:mt-0">
          <p className={cn(LEAD, "lg:text-[17px] lg:leading-[1.7]")}>
            {t.rich("lead", {
              ...RICH,
              wide: (chunks) => (
                <span className="hidden sm:inline">{chunks}</span>
              ),
              b: (chunks) => (
                <b className="font-bold whitespace-nowrap text-[var(--tv-ink)]">
                  {chunks}
                </b>
              ),
            })}
          </p>
          <div className="mt-5 flex flex-col gap-2 max-lg:[@media(max-height:600px)]:mt-3 max-lg:[@media(min-height:601px)_and_(max-height:700px)]:mt-4 lg:mt-6 lg:flex-row lg:flex-wrap lg:items-center lg:gap-x-3 lg:gap-y-2">
            <LandingCta
              label={t("start")}
              openOnWelcome
              className={cn(
                "h-[52px] w-full justify-center gap-2 max-lg:[@media(max-height:600px)]:h-11 border-transparent bg-[var(--tv-brand)] px-6 text-[15px] font-bold text-white hover:bg-[var(--tv-brand-deep)] focus-visible:border-transparent focus-visible:ring-0 lg:w-auto lg:px-5",
                FOCUS
              )}
            />
            <AppDownloadLink />
          </div>
        </div>
      </div>

      <HeroStage />
    </section>
  );
}
