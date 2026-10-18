import { helpGroups } from "@/app/(static)/help/_content/groups";
import { helpTopics } from "@/app/(static)/help/_content/topics";
import type { HelpGroup, HelpTopic } from "@/app/(static)/help/_content/types";

/** 페이지의 주소. 모든 안쪽 링크·검색·sitemap 이 이것 하나를 쓴다. */
export const helpPathOf = (topic: Pick<HelpTopic, "group" | "slug">) =>
  `/help/${topic.group}/${topic.slug}`;

export const helpGroupBySlug = (slug: string): HelpGroup | undefined =>
  helpGroups.find((group) => group.slug === slug);

export const helpTopicByPath = (group: string, slug: string) =>
  helpTopics.find((topic) => topic.group === group && topic.slug === slug);

export const helpTopicsOfGroup = (group: string) =>
  helpTopics.filter((topic) => topic.group === group);

export const helpAxisOf = (topic: Pick<HelpTopic, "group">) =>
  helpGroupBySlug(topic.group)?.axis ?? "feature";
