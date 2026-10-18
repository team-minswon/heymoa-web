import type { HelpGroup } from "@/app/(static)/help/_content/types";

/** 기능별 그룹(왼쪽 목록·허브 카드 순서)과 상황별 묶음. 그룹 slug 는 주소다 — 바꾸지 않는다. 한 그룹은 6페이지를 넘기지 않는다. */
export const helpGroups: readonly HelpGroup[] = [
  {
    slug: "start",
    title: "시작하기",
    summary: "로그인, 첫 회의, 화면 구성, 계정과 개인정보, 데스크톱 앱.",
    axis: "feature",
  },
  {
    slug: "record",
    title: "녹음과 받아쓰기",
    summary: "회의 녹음, 참석자와 화자, 회의 맥락·용어 사전, 실시간 타임라인.",
    axis: "feature",
  },
  {
    slug: "summary",
    title: "요약과 검토",
    summary: "회의 종료와 분석, 결정·할 일 검토와 확정, 복사·PDF·메일 공유.",
    axis: "feature",
  },
  {
    slug: "team",
    title: "함께 쓰기",
    summary: "할 일, 내 에이전트, 멤버와 임시 참여자, 문의·피드백.",
    axis: "feature",
  },
  {
    slug: "connect",
    title: "연결",
    summary: "Linear·GitHub 연동과 외부 AI 앱(MCP) 연결.",
    axis: "feature",
  },
  {
    slug: "fix",
    title: "문제 해결과 규칙",
    summary: "안내 문구별 해결 방법과 한도·규칙 모음.",
    axis: "feature",
  },
  {
    slug: "situations",
    title: "상황별로 찾기",
    summary:
      "상황별로 문제와 먼저 확인할 곳을 살펴보고 해결 단계를 따라 합니다.",
    axis: "situation",
  },
];
