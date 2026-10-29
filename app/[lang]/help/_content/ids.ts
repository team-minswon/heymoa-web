/**
 * 도움말 페이지 id(= 주소의 끝마디)와 그 페이지가 속한 그룹. 주소는 `/help/<그룹>/<id>` 이고 `HelpLink` 의 `topic` 이 이 id 다.
 * 페이지를 더하면 여기와 `topics.tsx` 에 같은 id · 그룹으로 넣는다(시험이 맞춘다). **바꾸면 그 링크가 깨진다.**
 */
export const HELP_PAGES = {
  // 기능별
  "getting-started": "start",
  "workspace-basics": "start",
  account: "start",
  desktop: "start",
  recording: "record",
  speakers: "record",
  "terms-context": "record",
  "live-timeline": "record",
  "meeting-end": "summary",
  review: "summary",
  export: "summary",
  tasks: "team",
  agent: "team",
  members: "team",
  feedback: "team",
  integrations: "connect",
  "agent-mcp": "connect",
  troubleshooting: "fix",
  // 상황별
  "first-meeting": "situations",
  "summary-missing": "situations",
  "confirm-summary": "situations",
  "fix-speakers": "situations",
  "invite-team": "situations",
  "fix-terms": "situations",
  "assign-tasks": "situations",
  "find-decisions": "situations",
  "record-call-audio": "situations",
  "desktop-no-audio": "situations",
  "use-mcp": "situations",
  "data-privacy": "situations",
  "agenda-map": "situations",
} as const;

export type HelpPageId = keyof typeof HELP_PAGES;
