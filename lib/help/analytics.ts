"use client";

import { usePathname } from "next/navigation";

import { helpGroups } from "@/app/[lang]/help/_content/groups";
import { track, type WebEventProperties } from "@/lib/analytics/track";
import { splitLocale } from "@/lib/i18n/locales";

/**
 * 가이드 이벤트가 싣는 값은 주소에서 뽑은 slug 뿐이다(우리가 정한 값). `/help` → hub, `/help/<그룹>` → 그룹 slug,
 * `/help/<그룹>/<페이지>` → 페이지 slug. 언어 접두사(`/en`)는 떼고 계산해 언어판이 달라도 같은 주제로 센다 — 언어는
 * `language` 로 따로 싣는다. 검색어·본문 글은 어떤 이벤트에도 싣지 않는다.
 */
export function helpLocation(pathname: string) {
  const { locale: language, path } = splitLocale(pathname);
  const [, , group = "", page = ""] = path.split("/");
  const axis =
    helpGroups.find((g) => g.slug === group)?.axis ?? ("feature" as const);
  if (!group)
    return { slug: "hub", group: "hub", level: "hub", axis: "hub", language } as const;
  if (!page) return { slug: group, group, level: "group", axis, language } as const;
  return { slug: page, group, level: "topic", axis, language } as const;
}

/** 지금 보는 가이드 페이지의 slug. */
export function useHelpSlug() {
  return helpLocation(usePathname() ?? "").slug;
}

type HelpEvent = Extract<keyof WebEventProperties, `help_${string}`>;

/** 가이드 이벤트를 보낸다. 지금 주소의 언어판을 `language` 로 붙인다(PRO-66). */
export function trackHelp<Event extends HelpEvent>(
  event: Event,
  properties: Omit<WebEventProperties[Event], "language">
) {
  track(event, {
    ...properties,
    language: splitLocale(window.location.pathname).locale,
  } as Parameters<typeof track<Event>>[1]);
}
