import type { HelpAxis } from "@/app/[lang]/help/_content/types";
import type { HelpPageId } from "@/app/[lang]/help/_content/ids";

/**
 * 기능별 그룹(왼쪽 목록·허브 카드 순서)과 상황별 묶음. 그룹 slug 는 주소다 — 바꾸지 않는다. 한 그룹은 6페이지를 넘기지 않는다.
 * 이름과 소개 글은 언어 파일(`help.groups.<slug>`)에 있다(`helpGroupsFor`). 여기는 주소와 축만 둔다 — 클라이언트(계측 · 탭)가
 * 언어 파일을 끌어오지 않고 읽는다.
 */
export const helpGroups: readonly { slug: string; axis: HelpAxis }[] = [
  { slug: "start", axis: "feature" },
  { slug: "record", axis: "feature" },
  { slug: "summary", axis: "feature" },
  { slug: "team", axis: "feature" },
  { slug: "connect", axis: "feature" },
  { slug: "fix", axis: "feature" },
  { slug: "situations", axis: "situation" },
];

/**
 * 상황별 레시피를 묶는 제목(사이드바 · 허브)의 키(`help.clusters.<key>`). 주소(`/help/situations/<slug>`)와 무관한 표시용
 * 묶음이고, 상황별 페이지는 모두 한 묶음에 들어야 한다(시험이 맞춘다). 묶음 안 순서가 곧 목록 순서다.
 */
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
    pages: ["summary-missing", "confirm-summary", "fix-speakers", "assign-tasks"],
  },
  { key: "connect", pages: ["find-decisions", "use-mcp", "data-privacy"] },
];
