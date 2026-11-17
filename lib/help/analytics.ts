"use client";

import { usePathname } from "next/navigation";

import { helpGroups } from "@/app/[lang]/help/_content/groups";
import { track, type WebEventProperties } from "@/lib/analytics/track";
import { splitLocale } from "@/lib/i18n/locales";

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

export function useHelpSlug() {
  return helpLocation(usePathname() ?? "").slug;
}

type HelpEvent = Extract<keyof WebEventProperties, `help_${string}`>;

export function trackHelp<Event extends HelpEvent>(
  event: Event,
  properties: Omit<WebEventProperties[Event], "language">
) {
  track(event, {
    ...properties,
    language: splitLocale(window.location.pathname).locale,
  } as Parameters<typeof track<Event>>[1]);
}
