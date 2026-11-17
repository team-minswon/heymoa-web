import { helpPathById } from "@/app/[lang]/help/_content/path-by-id";
import type { HelpPageId } from "@/app/[lang]/help/_content/ids";
import { localePath, type Locale } from "@/lib/i18n/locales";

const LEGACY: Readonly<Record<string, HelpPageId>> = {
  start: "getting-started",
  recording: "recording",
  desktop: "desktop",
  speakers: "speakers",
  summary: "review",
  tasks: "tasks",
  integrations: "integrations",
  agents: "agent-mcp",
  trouble: "troubleshooting",
  context: "terms-context",
  feedback: "feedback",
};

export const legacyHelpAnchors = (
  locale: Locale
): Readonly<Record<string, string>> =>
  Object.fromEntries(
    Object.entries(LEGACY).map(([hash, id]) => [
      hash,
      localePath(locale, helpPathById(id)),
    ])
  );

export const LEGACY_HELP_ANCHORS = legacyHelpAnchors("ko");
