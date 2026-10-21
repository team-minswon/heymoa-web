import { helpPathById } from "@/app/[lang]/help/_content/path-by-id";

/**
 * 한 장짜리 `/help` 시절의 `#id` → 새 주제 주소. 밖에 퍼진 링크를 `/help` 허브가 받아 옮긴다(`LegacyHashRedirect`).
 * 키를 지우지 않는다 — 이미 나간 링크는 늘 돌아온다.
 */
export const LEGACY_HELP_ANCHORS: Readonly<Record<string, string>> = {
  start: helpPathById("getting-started"),
  recording: helpPathById("recording"),
  desktop: helpPathById("desktop"),
  speakers: helpPathById("speakers"),
  summary: helpPathById("review"),
  tasks: helpPathById("tasks"),
  integrations: helpPathById("integrations"),
  agents: helpPathById("agent-mcp"),
  trouble: helpPathById("troubleshooting"),
  // 갱신판에서 새로 생긴 id 도 같은 이름으로 받는다
  context: helpPathById("terms-context"),
  feedback: helpPathById("feedback"),
};
