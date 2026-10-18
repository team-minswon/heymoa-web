/**
 * 사용 가이드 캡처 전용 목 프리셋 (`helpDemo`).
 *
 * 기본 목 데이터는 시험용이라 「테스트 유저」 같은 값이 많아 가이드 이미지에 못 쓴다. 이 프리셋은 가상의 마케팅
 * 팀(봄바람 스튜디오) 하나를 통째로 채운다. **꺼져 있으면 기본 목은 한 글자도 달라지지 않는다.**
 *
 * ## 켜는 법 (브라우저에서만)
 *
 * - `localStorage["heymoa:helpDemo"] === "1"` — Playwright 는 `page.addInitScript` 로 심는다
 * - 또는 주소 쿼리 `?helpDemo=1` — 한 번 보이면 localStorage 에도 적어 이동·새로고침 뒤에도 유지된다
 *
 * Node(vitest · SSR)에서는 `isHelpDemoEnabled()` 가 늘 false 다. 시험은 `createHelpDemoState()` 를 직접 부르거나
 * jsdom 의 localStorage 에 값을 넣은 뒤 `mockDb.reset()` 한다.
 *
 * ## 핵심 회의 3개 (캡처 스크립트가 이 ID 를 쓴다)
 *
 * | ID | 제목 | 용도 |
 * |---|---|---|
 * | `01KH000001001` | 4월 캠페인 성과 리뷰 | 종료 · 화자 분리 완료(화자 4명, A·B 지정 / C·D 미지정) · 검토본 완성(검토 전). 전사 213발화. 화자 지정 · 요약 · 검토 · 확정 화면 |
 * | `01KH000001002` | 신제품 소개 페이지 문구 정리 | 종료 · 검토 완료(확정). 전사 102발화. 확정된 요약 · 프로젝트 할 일에 반영된 모습 |
 * | `01KH000001003` | 주간 운영 점검 | 진행 중(열린 세션 없음). 앞 21발화가 있고, 녹음을 시작하면 목 전사 시나리오가 이어서 흘러나온다 |
 *
 * 그 밖에: 워크스페이스 `01K0000000000`(봄바람 스튜디오, 대표)와 `01K0000000009`(연습 공간, 비어 있음),
 * 프로젝트 5개(`01KH000000101`~`105`), 멤버 7명(나 포함), 임시 참여자 4명, 노트 30개, 할 일 44개, 용어 26개,
 * 문의 6건, 외부 에이전트 연결 4건(내 것 3), 챗봇 대화 4개, 동의 화면 `/oauth/consent?state=mock-consent`.
 *
 * 쉼표 일괄 등록 시연용 용어 「코호트, 리텐션, 이탈률」은 일부러 용어 사전에 넣지 않았다.
 *
 * 참고 — SSR 이 쓰는 `MOCK_USER`(lib/mocks/mock-user.ts)는 바꾸지 않는다. 프리셋의 현재 사용자는 같은 `userId` 에
 * 이름만 「김서윤」이다. 서버가 그리는 첫 HTML 에만 옛 이름이 잠깐 보일 수 있다.
 */
export { createHelpDemoState } from "@/lib/mocks/help-demo/build";
export { HELP_DEMO_CHAT_ANSWERS, HELP_DEMO_TERMS } from "@/lib/mocks/help-demo/misc";
export { HD_NOTE_IDS as HELP_DEMO_NOTE_IDS } from "@/lib/mocks/help-demo/notes";
export { HD_WORKSPACE_ID as HELP_DEMO_WORKSPACE_ID } from "@/lib/mocks/help-demo/people";
export { HELP_DEMO_ENDED_ITEMS, helpDemoReviewSets, type HelpDemoReviewSet } from "@/lib/mocks/help-demo/reviews";
export { HELP_DEMO_LIVE_SCRIPT } from "@/lib/mocks/help-demo/script-weekly";
export { helpDemoTaskRows, type TaskSeedRow } from "@/lib/mocks/help-demo/tasks";

export const HELP_DEMO_STORAGE_KEY = "heymoa:helpDemo";

export function isHelpDemoEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (new URLSearchParams(window.location.search).get("helpDemo") === "1") {
      try {
        window.localStorage.setItem(HELP_DEMO_STORAGE_KEY, "1");
      } catch {
        // 저장이 막힌 환경이면 이 문서 안에서만 켜진다
      }
      return true;
    }
    return window.localStorage.getItem(HELP_DEMO_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}
