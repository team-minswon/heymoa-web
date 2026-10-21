import { ArrowUpRight, Mail } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { Reveal } from "@/components/heymoa/landing/reveal";
import { siteConfig } from "@/lib/site";
import { cn } from "@/lib/utils";

import { LanguageSwitcher } from "./language-switcher";
import { ExampleStamp } from "./marks";
import { CONTAINER, FOCUS, TV_VARS, vars } from "./tokens";
import { NAV } from "./top-bar";

/** 브랜드·제품 탐색·문의의 순서로 읽고, 소셜 채널은 브랜드 아래에서 찾도록 합니다. */
const LINK = cn(
  "inline-flex min-h-8 items-center rounded-[4px] text-[15px] text-[var(--tv-body)] underline-offset-[5px] transition-colors hover:text-[var(--tv-ink)] hover:underline hover:decoration-[var(--tv-pop)] hover:decoration-[3px]",
  FOCUS
);

const HEADING = "m-0 text-[13px] font-bold text-[var(--tv-ink)]";

const COLUMNS: Array<{ title: string; links: Array<[string, string]> }> = [
  { title: "제품", links: NAV },
  {
    title: "안내",
    links: [
      ["데스크톱 다운로드", "/download"],
      ["이용약관", "/terms"],
      ["개인정보 처리방침", "/privacy"],
    ],
  },
];

export function LandingFooter({ example = false }: { example?: boolean }) {
  return (
    <footer
      style={TV_VARS}
      className="bg-white pt-10 font-sans text-[var(--tv-ink)]"
    >
      <svg
        aria-hidden
        viewBox="0 0 1440 48"
        preserveAspectRatio="none"
        className="-mb-px block h-10 w-full text-[var(--tv-lav)] lg:h-10"
      >
        <path
          fill="currentColor"
          d="M0 28C180 48 360 48 540 30S900 0 1080 14 1350 36 1440 26V48H0Z"
        />
      </svg>
      <div className="bg-[var(--tv-lav)]">
        <Reveal className={cn(CONTAINER, "pt-10 pb-6 lg:pt-12 lg:pb-8")}>
          <div className="grid grid-cols-2 gap-x-8 gap-y-10 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,0.9fr)_minmax(0,1fr)_minmax(0,1.3fr)] lg:gap-x-12">
            <div className="tv-r col-span-2 lg:col-span-1">
              <Link
                href="/"
                className={cn(
                  "inline-flex h-11 items-center gap-2.5 rounded-full",
                  FOCUS
                )}
              >
                <Image
                  src="/apple-touch-icon.png"
                  alt=""
                  width={36}
                  height={36}
                  className="rounded-full object-contain"
                />
                <span className="text-[22px] font-extrabold tracking-[-0.03em]">
                  {siteConfig.name}
                </span>
              </Link>
              <p className="m-0 mt-3 max-w-[270px] text-[15px] leading-[1.7] text-balance text-[var(--tv-body)]">
                회의 중에는 실시간으로 정리하고, 다음 회의에는 지난 논의를
                이어갑니다.
              </p>
              <nav aria-label="HeyMoa 소셜 채널" className="mt-5 flex gap-2.5">
                <a
                  href="https://www.instagram.com/heymoa.app/"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Instagram (새 탭에서 열림)"
                  title="Instagram"
                  className={cn(
                    "inline-flex size-11 items-center justify-center rounded-full border border-[var(--tv-rule-strong)] text-[var(--tv-body)] transition-colors hover:border-[var(--tv-ink)] hover:bg-white hover:text-[var(--tv-ink)]",
                    FOCUS
                  )}
                >
                  <svg
                    aria-hidden
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    className="size-5"
                  >
                    <path d="M7.0301.084c-1.2768.0602-2.1487.264-2.911.5634-.7888.3075-1.4575.72-2.1228 1.3877-.6652.6677-1.075 1.3368-1.3802 2.127-.2954.7638-.4956 1.6365-.552 2.914-.0564 1.2775-.0689 1.6882-.0626 4.947.0062 3.2586.0206 3.6671.0825 4.9473.061 1.2765.264 2.1482.5635 2.9107.308.7889.72 1.4573 1.388 2.1228.6679.6655 1.3365 1.0743 2.1285 1.38.7632.295 1.6361.4961 2.9134.552 1.2773.056 1.6884.069 4.9462.0627 3.2578-.0062 3.668-.0207 4.9478-.0814 1.28-.0607 2.147-.2652 2.9098-.5633.7889-.3086 1.4578-.72 2.1228-1.3881.665-.6682 1.0745-1.3378 1.3795-2.1284.2957-.7632.4966-1.636.552-2.9124.056-1.2809.0692-1.6898.063-4.948-.0063-3.2583-.021-3.6668-.0817-4.9465-.0607-1.2797-.264-2.1487-.5633-2.9117-.3084-.7889-.72-1.4568-1.3876-2.1228C21.2982 1.33 20.628.9208 19.8378.6165 19.074.321 18.2017.1197 16.9244.0645 15.6471.0093 15.236-.005 11.977.0014 8.718.0076 8.31.0215 7.0301.0839m.1402 21.6932c-1.17-.0509-1.8053-.2453-2.2287-.408-.5606-.216-.96-.4771-1.3819-.895-.422-.4178-.6811-.8186-.9-1.378-.1644-.4234-.3624-1.058-.4171-2.228-.0595-1.2645-.072-1.6442-.079-4.848-.007-3.2037.0053-3.583.0607-4.848.05-1.169.2456-1.805.408-2.2282.216-.5613.4762-.96.895-1.3816.4188-.4217.8184-.6814 1.3783-.9003.423-.1651 1.0575-.3614 2.227-.4171 1.2655-.06 1.6447-.072 4.848-.079 3.2033-.007 3.5835.005 4.8495.0608 1.169.0508 1.8053.2445 2.228.408.5608.216.96.4754 1.3816.895.4217.4194.6816.8176.9005 1.3787.1653.4217.3617 1.056.4169 2.2263.0602 1.2655.0739 1.645.0796 4.848.0058 3.203-.0055 3.5834-.061 4.848-.051 1.17-.245 1.8055-.408 2.2294-.216.5604-.4763.96-.8954 1.3814-.419.4215-.8181.6811-1.3783.9-.4224.1649-1.0577.3617-2.2262.4174-1.2656.0595-1.6448.072-4.8493.079-3.2045.007-3.5825-.006-4.848-.0608M16.953 5.5864A1.44 1.44 0 1 0 18.39 4.144a1.44 1.44 0 0 0-1.437 1.4424M5.8385 12.012c.0067 3.4032 2.7706 6.1557 6.173 6.1493 3.4026-.0065 6.157-2.7701 6.1506-6.1733-.0065-3.4032-2.771-6.1565-6.174-6.1498-3.403.0067-6.156 2.771-6.1496 6.1738M8 12.0077a4 4 0 1 1 4.008 3.9921A3.9996 3.9996 0 0 1 8 12.0077" />
                  </svg>
                </a>
                <a
                  href="https://www.threads.com/@heymoa.app"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Threads (새 탭에서 열림)"
                  title="Threads"
                  className={cn(
                    "inline-flex size-11 items-center justify-center rounded-full border border-[var(--tv-rule-strong)] text-[var(--tv-body)] transition-colors hover:border-[var(--tv-ink)] hover:bg-white hover:text-[var(--tv-ink)]",
                    FOCUS
                  )}
                >
                  {/* Simple Icons의 Threads 브랜드 마크(CC0). */}
                  <svg
                    aria-hidden
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    className="size-5"
                  >
                    <path d="M18.263 11.097c-.03-3.486-1.92-5.586-5.111-5.586-2.13 0-3.922.963-4.863 2.499l2.062 1.438c.535-.843 1.272-1.543 2.628-1.543 1.528 0 2.318.85 2.544 2.431a15 15 0 0 0-2.236-.173c-4.125 0-6.068 1.867-6.068 4.336s1.943 3.99 4.804 3.99c3.139 0 5.013-2.115 5.781-4.735.798.361 1.348 1.204 1.348 2.47 0 3.387-3.907 5.232-7.22 5.232-4.885 0-8.077-3.207-8.077-8.424 0-6.392 4.223-10.487 9.9-10.487 3.808 0 5.69 1.671 6.97 3.914l2.108-1.475C21.44 2.078 18.331 0 13.663 0 6.227 0 1.168 5.277 1.168 12.934c0 7 4.953 11.066 10.856 11.066 4.878 0 9.809-2.846 9.809-7.716 0-2.545-1.46-4.231-3.569-5.187m-6.33 4.855c-1.077 0-2.026-.512-2.026-1.453 0-1.483 1.822-1.934 3.606-1.934.678 0 1.34.045 1.927.173-.422 1.927-1.671 3.215-3.508 3.214Z" />
                  </svg>
                </a>
              </nav>
            </div>

            {COLUMNS.map((column, i) => (
              <nav
                key={column.title}
                aria-label={`푸터 ${column.title}`}
                className="tv-r"
                style={vars({ "--i": i + 1 })}
              >
                <h2 className={HEADING}>{column.title}</h2>
                <ul className="m-0 mt-3 flex list-none flex-col gap-1 p-0">
                  {column.links.map(([label, href]) => (
                    <li key={href}>
                      <Link href={href} className={LINK}>
                        {label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            ))}

            <div
              className="tv-r col-span-2 lg:col-span-1"
              style={vars({ "--i": 3 })}
            >
              <h2 className={HEADING}>함께 만들어요</h2>
              <p className="m-0 mt-3 text-[15px] leading-[1.7] text-[var(--tv-body)]">
                써보며 느낀 점이나 궁금한 점을 들려주세요.
              </p>
              <a
                href={`mailto:${siteConfig.contactEmail}`}
                className={cn(
                  "mt-3 inline-flex min-h-11 items-center gap-2 rounded-[4px] text-[14px] font-semibold text-[var(--tv-ink)] hover:underline underline-offset-4",
                  FOCUS
                )}
              >
                <Mail aria-hidden className="size-4 shrink-0" />
                <span className="break-all">{siteConfig.contactEmail}</span>
                <ArrowUpRight aria-hidden className="size-4 shrink-0" />
              </a>
            </div>
          </div>

          <div className="mt-10 flex flex-col gap-2 border-t border-[var(--tv-rule-strong)] pt-5 text-[13px] leading-[1.6] text-[var(--tv-muted)] lg:mt-12 xl:flex-row xl:flex-wrap xl:items-center xl:justify-between">
            {example ? (
              <p className="m-0 flex items-center gap-2.5">
                <ExampleStamp />이 페이지의 회의, 인물, 날짜는 모두 지어낸
                예시입니다.
              </p>
            ) : null}
            <LanguageSwitcher />
            <p className="m-0">
              © 2026 {siteConfig.name}. All rights reserved.
            </p>
            <p className="m-0">
              AI 회의 에이전트는 사용자의 업무 효율을 높이는 보조 수단입니다.
            </p>
          </div>
        </Reveal>
      </div>
    </footer>
  );
}
