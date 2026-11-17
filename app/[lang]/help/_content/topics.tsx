import {
  helpGroups,
  situationClusters,
} from "@/app/[lang]/help/_content/groups";
import type {
  HelpCluster,
  HelpGroup,
  HelpTopic,
} from "@/app/[lang]/help/_content/types";
import { messagesFor } from "@/i18n/messages";
import { loadHelpTopics } from "@/lib/help/content";
import type { Locale } from "@/lib/i18n/locales";

export const helpTopicsFor = (locale: Locale): readonly HelpTopic[] =>
  loadHelpTopics(locale);

export const helpTopics: readonly HelpTopic[] = helpTopicsFor("ko");

export const helpTopicBySlug = (slug: string, locale: Locale = "ko") =>
  helpTopicsFor(locale).find((topic) => topic.slug === slug);

export const helpGroupsFor = (locale: Locale): readonly HelpGroup[] => {
  const text = messagesFor(locale).help.groups;
  return helpGroups.map((group) => ({
    ...group,
    ...text[group.slug as keyof typeof text],
  }));
};

export const situationClustersFor = (
  locale: Locale
): readonly HelpCluster[] => {
  const text = messagesFor(locale).help.clusters;
  return situationClusters.map(({ key, pages }) => ({
    title: text[key],
    pages,
  }));
};
