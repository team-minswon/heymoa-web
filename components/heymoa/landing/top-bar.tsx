import Image from "next/image";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { LandingCta } from "@/components/heymoa/landing-cta";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLinkItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { localePath } from "@/lib/i18n/locales";
import { siteConfig } from "@/lib/site";

import { CONTAINER, FOCUS, TV_VARS } from "./tokens";
import { AppDownloadLink } from "./app-download-link";
import { RICH } from "./rich";

/**
 * 구간 다섯으로 가는 메뉴. 푸터 「둘러보기」도 이것을 쓴다. 이름은 구간이 보여 주는 것(회의 정리 · 근거
 * 확인 · 프로젝트 · 내 에이전트 · 도구 연결)이다 — 전의 「회의별로 · 그 말 확인 · 팀 · 물어보기 · 다른 도구로」는
 * 구간 제목에서 낱말을 떼어 와 메뉴만 보고는 무엇이 있는지 읽히지 않았다.
 * href 는 그 언어 랜딩 주소 + `#…` 다(`/#meetings`, `/en#meetings`) — 약관 · 개인정보 페이지도 이 바를 써서,
 * `#…` 만 두면 그 페이지 안에서 헛돈다.
 */
const SECTIONS = ["meetings", "evidence", "team", "ask", "safety"] as const;

/** 구간 다섯의 [이름, 주소]. 현재 언어로 낸다. */
export function useSectionNav(): Array<[string, string]> {
  const t = useTranslations("landing.nav");
  const home = localePath(useLocale(), "/");
  return SECTIONS.map((id) => [t(`sections.${id}`), `${home}#${id}`]);
}

/**
 * 상단 바. `<main>` 밖(`NavbarGate`)에 서서 `.tv-root` 의 변수를 못 받으니 `TV_VARS` 를 직접 건다.
 * tl;dv 의 흰 가로 바를 따랐고, 앱 Navbar 의 떠 있는 알약은 쓰지 않았다.
 * 로고는 Navbar 와 같은 자산(`/apple-touch-icon.png`)이다. md 미만은 로고 + 시작하기만 남는다.
 * 메뉴는 셋이다 — 구간 다섯은 「기능」 하나로 접고(펼치면 `useSectionNav`), 다른 페이지로 가는 다운로드 · 도움말을 옆에
 * 둔다. 다섯을 펼쳐 두면 페이지 링크가 붙을 때마다 한 줄이 넘쳤다(768 에서 도움말 하나로 CTA 가 12px 밀렸다).
 * 셋이면 768 에도 넉넉해 md 부터 다 보인다.
 * 시작 버튼에 hover·포커스하면 아래 툴팁으로 웹·앱의 녹음 범위를 안내한다.
 *
 * 시작하기의 포커스 링은 하나다. `Button` 기본의 `focus-visible:ring-3` · `border-ring` 을 끄고 보라
 * outline(`FOCUS`)만 쓰는데, 칠한 알약에 `outline-offset-2` 를 그대로 두면 「보라 알약 · 흰 틈 · 보라 선」이
 * 동심 테두리 두 겹으로 읽혔다(1440 실측). 그래서 이 버튼만 틈을 0 으로 붙이고, `Button` 의
 * `bg-clip-padding` + 투명 1px 테두리가 남기던 흰 실선도 `bg-clip-border` 와 포커스 때 테두리를 링과
 * 같은 색으로 칠해 없앤다 — 포커스는 알약 가장자리의 진보라 테 3px 하나로만 보인다(바깥 흰 바탕 대비 8.8:1).
 */
export function TopBar() {
  const t = useTranslations("landing.nav");
  const locale = useLocale();
  const nav = useSectionNav();
  return (
    <header style={TV_VARS} className="sticky top-0 z-30 border-b border-[var(--tv-rule)] bg-white/90 backdrop-blur-md">
      <div className={`${CONTAINER} flex h-16 items-center gap-4`}>
        <Link
          href={localePath(locale, "/")}
          className={`inline-flex h-11 shrink-0 items-center gap-2.5 rounded-full ${FOCUS}`}
        >
          <Image
            src="/apple-touch-icon.png"
            alt=""
            width={32}
            height={32}
            className="rounded-full object-contain"
            priority
          />
          <span className="text-[18px] font-extrabold tracking-[-0.03em] text-[var(--tv-ink)]">
            {siteConfig.name}
          </span>
        </Link>

        <nav aria-label={t("label")} className="ml-3 hidden items-center gap-1 md:flex">
          <DropdownMenu>
            {/* 펼친 목록은 포털로 `<body>` 에 붙어 이 바의 `TV_VARS` 를 못 받으니 다시 건다. */}
            <DropdownMenuTrigger className={`group inline-flex h-11 items-center gap-1 whitespace-nowrap rounded-full px-3 text-[15px] font-semibold text-[var(--tv-body)] transition-colors hover:text-[var(--tv-brand-deep)] data-popup-open:text-[var(--tv-brand-deep)] ${FOCUS}`}>
              {t("features")}
              <ChevronDown aria-hidden className="size-4 transition-transform group-data-popup-open:rotate-180" />
            </DropdownMenuTrigger>
            <DropdownMenuContent style={TV_VARS} sideOffset={6} className="w-auto min-w-44 p-1.5">
              {/* `Link` 다 — 약관 · 개인정보에서 누르면 `/` 로 넘어가는데, 일반 `<a>` 면 문서를 통째로 다시 받아
                  녹음 중이던 회의가 끊긴다(녹음은 route 를 넘어 살아야 한다 — 옛 Navbar 의 `router.push` 와 같은 이유). */}
              {nav.map(([label, href]) => (
                <DropdownMenuLinkItem
                  key={href}
                  href={href}
                  className="h-10 px-3 text-[15px] font-semibold text-[var(--tv-body)] focus:bg-[var(--tv-lav)] focus:text-[var(--tv-brand-deep)]"
                >
                  {label}
                </DropdownMenuLinkItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          {/* 푸터 「제품」(`useSectionNav`)에는 넣지 않는다 — 다운로드는 푸터 「안내」에 따로 있다. */}
          <AppDownloadLink variant="nav" />
          <Link href={localePath(locale, "/help")} className={`inline-flex h-11 items-center gap-1 whitespace-nowrap rounded-full px-3 text-[15px] font-semibold text-[var(--tv-body)] transition-colors hover:text-[var(--tv-brand-deep)] ${FOCUS}`}>
            {t("guide")}
          </Link>
        </nav>

        <div className="ml-auto flex items-center">
          <LandingCta
            label={t("start")}
            tooltip={t.rich("startTooltip", RICH)}
            className={`h-11 border-transparent bg-[var(--tv-brand)] px-5 text-[14px] font-bold text-white bg-clip-border hover:bg-[var(--tv-brand-deep)] focus-visible:border-[var(--tv-brand-deep)] focus-visible:ring-0 lg:h-10 ${FOCUS} focus-visible:outline-offset-0`}
          />
        </div>
      </div>
    </header>
  );
}
