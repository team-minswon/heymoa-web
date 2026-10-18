import { connectTopics } from "@/app/(static)/help/_content/feature-connect";
import { fixTopics } from "@/app/(static)/help/_content/feature-fix";
import { recordTopics } from "@/app/(static)/help/_content/feature-record";
import { startTopics } from "@/app/(static)/help/_content/feature-start";
import { summaryTopics } from "@/app/(static)/help/_content/feature-summary";
import { teamTopics } from "@/app/(static)/help/_content/feature-team";
import { situationTopics } from "@/app/(static)/help/_content/situations";
import type { HelpTopic } from "@/app/(static)/help/_content/types";

/**
 * 사용 가이드의 모든 페이지(APP-1231). 순서가 허브 · 목차 · 이전/다음 순서다 — 기능별 그룹 순서대로, 상황별이 맨 뒤다.
 * 화면 이름은 **지금 UI 문구 그대로** 쓴다(코드로 확인한 것만). 문구를 바꾸는 PR 은 여기도 같이 고친다. 같은 설명을 여러
 * 페이지에 복사하지 않고 한 곳에 쓰고 링크한다. 본문은 「~합니다」 체, 화면 문구를 그대로 옮긴 곳만 화면의 어미를 따른다.
 *
 * 설명은 기능 페이지가 원본이고, 상황별 페이지는 단계와 링크만 둔다(`recipe()`).
 */
export const helpTopics: readonly HelpTopic[] = [
  ...startTopics,
  ...recordTopics,
  ...summaryTopics,
  ...teamTopics,
  ...connectTopics,
  ...fixTopics,
  ...situationTopics,
];

export const helpTopicBySlug = (slug: string) =>
  helpTopics.find((topic) => topic.slug === slug);
