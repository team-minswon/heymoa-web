import type { HelpCluster, HelpGroup } from "@/app/(static)/help/_content/types";

/** 기능별 그룹(왼쪽 목록·허브 카드 순서)과 상황별 묶음. 그룹 slug 는 주소다 — 바꾸지 않는다. 한 그룹은 6페이지를 넘기지 않는다. */
export const helpGroups: readonly HelpGroup[] = [
  {
    slug: "start",
    title: "시작하기",
    summary: "HeyMoa(헤이모아)에 로그인하고, 첫 회의를 기록하고, 화면과 계정, 데스크톱 앱을 알아봐요.",
    axis: "feature",
  },
  {
    slug: "record",
    title: "녹음과 받아쓰기",
    summary: "회의를 녹음하고 받아쓰는 동안 참석자와 화자를 정하고, 용어 사전과 타임라인을 쓰는 방법이에요.",
    axis: "feature",
  },
  {
    slug: "summary",
    title: "요약과 검토",
    summary: "회의를 종료하면 AI가 정리한 결정과 할 일을 검토해 확정하고, 복사·PDF·메일로 나눌 수 있어요.",
    axis: "feature",
  },
  {
    slug: "team",
    title: "함께 쓰기",
    summary: "팀과 함께 할 일을 나누고, 내 에이전트에게 회의 내용을 묻고, 멤버를 초대하고, 문의를 보내요.",
    axis: "feature",
  },
  {
    slug: "connect",
    title: "연결",
    summary: "Linear, GitHub 같은 외부 도구를 잇고, 외부 AI 앱(MCP)에서 내 회의를 읽게 해요.",
    axis: "feature",
  },
  {
    slug: "fix",
    title: "문제 해결과 규칙",
    summary: "HeyMoa(헤이모아)를 쓰다 만나는 안내 문구별 해결 방법과, 녹음·요약·초대의 한도와 규칙을 한곳에 모았어요.",
    axis: "feature",
  },
  {
    slug: "situations",
    title: "상황별로 찾기",
    summary:
      "첫 회의 기록, 녹음 문제, 요약 검토처럼 HeyMoa(헤이모아)에서 겪는 상황을 고르면 먼저 볼 곳과 해결 단계를 알려 줘요.",
    axis: "situation",
  },
];

/**
 * 상황별 레시피를 묶는 제목(사이드바 · 허브). 주소(`/help/situations/<slug>`)와 무관한 표시용 묶음이고, 상황별 페이지는 모두 한 묶음에
 * 들어야 한다(시험이 맞춘다). 묶음 안 순서가 곧 목록 순서다.
 */
export const situationClusters: readonly HelpCluster[] = [
  { title: "처음 시작", pages: ["first-meeting", "invite-team"] },
  {
    title: "녹음이 이상할 때",
    pages: ["desktop-no-audio", "fix-terms", "record-call-audio"],
  },
  {
    title: "요약과 할 일",
    pages: ["summary-missing", "confirm-summary", "fix-speakers", "assign-tasks"],
  },
  {
    title: "찾고 연결하기",
    pages: ["find-decisions", "use-mcp", "data-privacy"],
  },
];
