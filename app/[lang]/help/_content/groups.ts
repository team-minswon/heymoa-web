import type { HelpAxis } from "@/app/[lang]/help/_content/types";
import type { HelpPageId } from "@/app/[lang]/help/_content/ids";

export const helpGroups: readonly { slug: string; axis: HelpAxis }[] = [
  { slug: "start", axis: "feature" },
  { slug: "record", axis: "feature" },
  { slug: "summary", axis: "feature" },
  { slug: "team", axis: "feature" },
  { slug: "connect", axis: "feature" },
  { slug: "fix", axis: "feature" },
  { slug: "situations", axis: "situation" },
];

export const situationClusters: readonly {
  key: "start" | "recording" | "summary" | "connect";
  pages: readonly HelpPageId[];
}[] = [
  { key: "start", pages: ["first-meeting", "invite-team"] },
  {
    key: "recording",
    pages: ["desktop-no-audio", "fix-terms", "record-call-audio"],
  },
  {
    key: "summary",
    pages: ["summary-missing", "confirm-summary", "fix-speakers", "assign-tasks", "agenda-map"],
  },
  { key: "connect", pages: ["find-decisions", "use-mcp", "data-privacy"] },
];
