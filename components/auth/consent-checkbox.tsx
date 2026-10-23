"use client";

import { useEffect, useRef } from "react";
import { useLocale, useTranslations } from "next-intl";

import { SitePageLink } from "@/components/heymoa/site-page-link";
import { Checkbox } from "@/components/ui/checkbox";
import { DEFAULT_LOCALE, isLocale, localePath } from "@/lib/i18n/locales";

/** 체크박스 테두리를 빨갛게 했다가 원래 색으로 돌린다. 움직임을 줄인 사용자에게는 이것만 보인다. */
const ALERT_COLOR: Keyframe[] = [
  {
    borderColor: "var(--el-error)",
    boxShadow:
      "0 0 0 3px color-mix(in oklch, var(--el-error) 25%, transparent)",
  },
  {
    offset: 0.7,
    borderColor: "var(--el-error)",
    boxShadow:
      "0 0 0 3px color-mix(in oklch, var(--el-error) 25%, transparent)",
  },
  {
    borderColor: "var(--el-hairline-strong)",
    boxShadow: "0 0 0 0 transparent",
  },
];
/** 색에 더해 좌우로 가볍게 흔든다. transform 이라 옆 글자도 모달 높이도 밀지 않는다. */
const ALERT_SHAKE: Keyframe[] = [
  { ...ALERT_COLOR[0], transform: "translateX(0)" },
  { offset: 0.15, transform: "translateX(-3px)" },
  { offset: 0.3, transform: "translateX(3px)" },
  { offset: 0.45, transform: "translateX(-2px)" },
  { offset: 0.6, transform: "translateX(0)" },
  { ...ALERT_COLOR[1] },
  { ...ALERT_COLOR[2], transform: "translateX(0)" },
];

/**
 * 「개인정보 처리방침과 이용약관을 읽었으며 이에 동의합니다」(APP-1277). 로그인 창·로그인 카드·동의를 다시 받는
 * callback 화면이 같은 것을 쓴다. 문서 이름은 각 문서로 가는 링크다.
 *
 * 다음 동작이 왜 막혔는지(`hint`)는 **화면에 줄로 두지 않는다** — 체크하면 줄이 사라져 창 높이가 바뀌었다
 * (APP-1402). 막힌 버튼은 흐리게만 보이고, 체크하지 않은 채 누르면 호출한 쪽이 `nudge` 를 올린다. 그때 체크박스로
 * 초점을 옮기고 짧게 강조하며, 스크린리더에는 숨긴 문장으로 알린다. `hintId` 는 막힌 버튼의
 * `aria-describedby` 에도 쓰도록 호출한 쪽이 만든다.
 */
export function ConsentCheckbox({
  checked,
  onCheckedChange,
  hint,
  hintId,
  nudge,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  hint: string;
  hintId: string;
  /** 체크하지 않은 채 다음 동작을 누른 횟수. 오를 때마다 강조한다. */
  nudge: number;
}) {
  const t = useTranslations("auth.consent");
  const locale = useLocale();
  const box = useRef<HTMLElement>(null);
  const language = isLocale(locale) ? locale : DEFAULT_LOCALE;

  useEffect(() => {
    const element = box.current;
    if (!nudge || !element) return;
    element.focus();
    const reduce = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    // jsdom 에는 Web Animations 가 없다.
    element.animate?.(reduce ? ALERT_COLOR : ALERT_SHAKE, { duration: 700 });
  }, [nudge]);

  // 로그인 창을 닫지 않고 문서를 읽도록 브라우저에서는 새 탭으로 열린다(`SitePageLink`).
  const documentLink = (path: string) => {
    const DocumentLink = (chunks: React.ReactNode) => (
      <SitePageLink
        href={localePath(language, path)}
        className="underline underline-offset-2 hover:text-[var(--el-ink)]"
      >
        {chunks}
      </SitePageLink>
    );
    return DocumentLink;
  };

  return (
    <div className="text-left">
      <label className="flex cursor-pointer items-start gap-2.5 text-[13px] leading-5 text-[var(--el-body)]">
        <Checkbox
          ref={box}
          className="mt-0.5"
          checked={checked}
          onCheckedChange={onCheckedChange}
          aria-describedby={checked ? undefined : hintId}
        />
        <span>
          {t.rich("label", {
            privacy: documentLink("/privacy"),
            terms: documentLink("/terms"),
          })}
        </span>
      </label>
      {!checked && (
        <span id={hintId} className="sr-only">
          {hint}
        </span>
      )}
      {/* 누를 때마다 새 노드로 바꿔 같은 문장도 다시 읽힌다. */}
      <span role="status" className="sr-only">
        {nudge > 0 && !checked && <span key={nudge}>{hint}</span>}
      </span>
    </div>
  );
}
