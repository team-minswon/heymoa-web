import type { ParsedScript } from "@/lib/mocks/help-demo/script";

/** 프리셋 조립(`build.ts`)이 쓰는 이름과 짧은 문구. 영어판은 `en/text.ts`. */
export const HD_TEXT = {
  workspaceName: "봄바람 스튜디오",
  workspaceDescription: "캠페인, 신제품 출시, 고객 인터뷰를 함께 챙기는 마케팅 팀의 공간입니다.",
  practiceWorkspaceName: "연습 공간",
  /** 나를 초대한 다른 워크스페이스 */
  invitingWorkspaceName: "디자인 팀",
};

/** 챗봇 목 스트림(`chat-stream.ts`)의 기본 답변 경로가 흘리는 진행 문구. 가이드 캡처에만 쓴다. */
export const CHAT_STREAM_TEXT = {
  thisNote: "이 회의록",
  searching: (title: string) => `${title}에서 물어보신 내용을 찾습니다.`,
  skim: "스크립트에서 관련 발화를 먼저 훑겠습니다.",
  toolSummary: "스크립트에서 관련 발화 검색",
  found: "3건 찾음",
  composing: "찾은 발화로 답을 정리합니다.",
};

/** 일시정지된 회의(FAQ 초안 리뷰)에 남은 앞부분 전사. */
export const PAUSED_SCRIPT: ParsedScript = {
  lines: [
    { label: "A", text: "FAQ 초안 스무 개 중에 열두 개를 먼저 같이 볼게요." },
    { label: "B", text: "네, 출시일과 가격 질문은 아직 확정이 안 돼서 비워 두었어요." },
    { label: "A", text: "그 두 개는 빼고 나머지부터 문구를 다듬죠." },
  ],
  anchors: {},
};
