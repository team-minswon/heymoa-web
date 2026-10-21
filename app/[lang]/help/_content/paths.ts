import {
  helpGroupsFor,
  helpTopicsFor,
} from "@/app/[lang]/help/_content/topics";
import type { HelpGroup, HelpTopic } from "@/app/[lang]/help/_content/types";
import { helpGroups } from "@/app/[lang]/help/_content/groups";
import type { Locale } from "@/lib/i18n/locales";

/** 페이지의 무접두 주소. 언어판 주소는 `localePath(locale, …)` 로 감싼다. 모든 안쪽 링크·검색·sitemap 이 이것 하나를 쓴다. */
export const helpPathOf = (topic: Pick<HelpTopic, "group" | "slug">) =>
  `/help/${topic.group}/${topic.slug}`;

export const helpGroupBySlug = (
  slug: string,
  locale: Locale = "ko"
): HelpGroup | undefined =>
  helpGroupsFor(locale).find((group) => group.slug === slug);

export const helpTopicByPath = (
  group: string,
  slug: string,
  locale: Locale = "ko"
) =>
  helpTopicsFor(locale).find(
    (topic) => topic.group === group && topic.slug === slug
  );

export const helpTopicsOfGroup = (group: string, locale: Locale = "ko") =>
  helpTopicsFor(locale).filter((topic) => topic.group === group);

export const helpAxisOf = (topic: Pick<HelpTopic, "group">) =>
  helpGroups.find((group) => group.slug === topic.group)?.axis ?? "feature";

/** 사이드바 · 이전/다음 · 허브 카드에 쓰는 짧은 이름. */
export const navTitleOf = (topic: Pick<HelpTopic, "title" | "navTitle">) =>
  topic.navTitle ?? topic.title;
