import type { ReactNode } from "react";

import type { HelpPageId } from "@/app/(static)/help/_content/ids";

export type HelpSection = {
  /** 이 페이지 안에서 겹치지 않는 id. 바깥 링크가 `#id` 로 온다. */
  id: string;
  title: string;
  body: readonly ReactNode[];
};

/** 가이드의 두 축: 기능별(그룹 아래 페이지)과 상황별(「이럴 때 어떻게 하나요」 레시피). */
export type HelpAxis = "feature" | "situation";

export type HelpGroup = {
  /** 주소 `/help/<slug>`(그룹 소개)와 `/help/<slug>/<페이지>` 의 첫 마디. */
  slug: string;
  title: string;
  summary: string;
  axis: HelpAxis;
};

export type HelpTopic = {
  /** 사이트 안에서 겹치지 않는 이름이자 주소의 끝마디. 바꾸면 그 링크가 깨진다 — 옛 주소는 `legacy-anchors.ts` 가 받는다. */
  slug: HelpPageId;
  /** `HelpGroup.slug` */
  group: string;
  title: string;
  /** 허브 카드와 meta description 에 쓴다(한국어 110자 안팎). */
  summary: string;
  sections: readonly HelpSection[];
  /** 상황별 레시피에서 단계가 분명할 때만: JSON-LD `HowTo` 의 단계(본문에 있는 글과 같아야 한다). */
  howTo?: readonly string[];
  /** 상황별 레시피가 가리키는 기능 페이지. 그 기능 페이지 끝에 「이런 상황에서 보세요」 역링크가 자동으로 선다. */
  related?: readonly HelpPageId[];
};
