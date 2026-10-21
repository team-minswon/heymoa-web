import { helpPathById } from "@/app/[lang]/help/_content/path-by-id";
import type { HelpPageId } from "@/app/[lang]/help/_content/ids";
import { localePath, type Locale } from "@/lib/i18n/locales";

/**
 * 한 장짜리 `/help` 시절의 `#id` → 새 주제 id. 밖에 퍼진 링크를 `/help` 허브가 받아 옮긴다(`LegacyHashRedirect`).
 * 키를 지우지 않는다 — 이미 나간 링크는 늘 돌아온다.
 */
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
  // 갱신판에서 새로 생긴 id 도 같은 이름으로 받는다
  context: "terms-context",
  feedback: "feedback",
};

/** 옛 앵커 → 그 언어의 주제 주소(`/en/help#start` → `/en/help/start/getting-started`). */
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
