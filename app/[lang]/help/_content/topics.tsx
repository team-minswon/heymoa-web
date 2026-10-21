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

/**
 * 사용 가이드의 모든 페이지(APP-1231). 본문은 `content/help/<그룹>/<slug>.md`(영어는 `content/help/en/...`)에 있고
 * (작성 문법은 그 폴더의 README), 순서가 허브 · 목차 · 이전/다음 순서다 — 기능별 그룹 순서대로, 상황별이 맨 뒤다.
 * 화면 이름은 **지금 UI 문구 그대로** 쓴다(코드로 확인한 것만). 문구를 바꾸는 PR 은 여기 마크다운도 같이 고친다.
 * 같은 설명을 여러 페이지에 복사하지 않고 한 곳에 쓰고 링크한다. 본문은 해요체다.
 *
 * 설명은 기능 페이지가 원본이고, 상황별 페이지는 단계와 링크만 둔다. 언어판은 주소 · 섹션 id 가 같다(시험이 맞춘다).
 */
export const helpTopicsFor = (locale: Locale): readonly HelpTopic[] =>
  loadHelpTopics(locale);

/** 한국어판. 주소만 쓰는 곳(sitemap · 정적 경로)은 언어와 무관하게 이것을 쓴다. */
export const helpTopics: readonly HelpTopic[] = helpTopicsFor("ko");

export const helpTopicBySlug = (slug: string, locale: Locale = "ko") =>
  helpTopicsFor(locale).find((topic) => topic.slug === slug);

/** 그룹 이름 · 소개를 그 언어로 붙인다. */
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
