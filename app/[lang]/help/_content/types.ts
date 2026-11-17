import type { ReactNode } from "react";

import type { HelpPageId } from "@/app/[lang]/help/_content/ids";

export type HelpSection = {
  id: string;
  title: string;
  body: readonly ReactNode[];
};

export type HelpAxis = "feature" | "situation";

export type HelpGroup = {
  slug: string;
  title: string;
  summary: string;
  axis: HelpAxis;
};

export type HelpCluster = {
  title: string;
  pages: readonly HelpPageId[];
};

export const HELP_BADGES = ["desktop"] as const;
export type HelpBadgeName = (typeof HELP_BADGES)[number];

export type HelpTopic = {
  slug: HelpPageId;
  group: string;
  title: string;
  navTitle?: string;
  badge?: HelpBadgeName;
  summary: string;
  modified: string;
  sections: readonly HelpSection[];
  howTo?: readonly string[];
  faq?: readonly { question: string; answer: string }[];
  related?: readonly HelpPageId[];
};
