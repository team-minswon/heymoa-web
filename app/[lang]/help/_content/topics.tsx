import type { HelpTopic } from "@/app/[lang]/help/_content/types";
import { loadHelpTopics } from "@/lib/help/content";

/**
 * 사용 가이드의 모든 페이지(APP-1231). 본문은 `content/help/<그룹>/<slug>.md` 에 있고(작성 문법은 그 폴더의 README),
 * 순서가 허브 · 목차 · 이전/다음 순서다 — 기능별 그룹 순서대로, 상황별이 맨 뒤다.
 * 화면 이름은 **지금 UI 문구 그대로** 쓴다(코드로 확인한 것만). 문구를 바꾸는 PR 은 여기 마크다운도 같이 고친다.
 * 같은 설명을 여러 페이지에 복사하지 않고 한 곳에 쓰고 링크한다. 본문은 해요체다.
 *
 * 설명은 기능 페이지가 원본이고, 상황별 페이지는 단계와 링크만 둔다.
 */
export const helpTopics: readonly HelpTopic[] = loadHelpTopics();

export const helpTopicBySlug = (slug: string) =>
  helpTopics.find((topic) => topic.slug === slug);
