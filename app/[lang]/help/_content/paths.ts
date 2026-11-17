import {
  helpGroupsFor,
  helpTopicsFor,
} from "@/app/[lang]/help/_content/topics";
import type { HelpGroup, HelpTopic } from "@/app/[lang]/help/_content/types";
import { helpGroups } from "@/app/[lang]/help/_content/groups";
import type { Locale } from "@/lib/i18n/locales";

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

export const navTitleOf = (topic: Pick<HelpTopic, "title" | "navTitle">) =>
  topic.navTitle ?? topic.title;
