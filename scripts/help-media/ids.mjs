/**
 * 캡처가 쓰는 화면 식별자. 가이드 전용 목 프리셋(`lib/mocks/help-demo`)이 켜졌을 때의 값이다.
 * 프리셋의 회의 ID 는 `lib/mocks/help-demo/index.ts` 맨 위 표가 원본이다 — 바뀌면 여기도 고친다.
 * 프리셋 없이 기본 목으로 시험해 볼 때는 `HELP_DEMO=0` 으로 기본 목 ID 를 쓴다(셀렉터 점검용).
 */
export const DEMO = process.env.HELP_DEMO !== "0";

export const IDS = DEMO
  ? {
      workspace: "01K0000000000",
      // 종료 · 화자 분리 완료(C·D 미지정) · 검토본 완성(검토 전)
      endedDiarized: "01KH000001001",
      reviewing: "01KH000001001",
      // 종료 · 검토 완료(확정)
      confirmed: "01KH000001002",
      // 진행 중 — 녹음을 시작하면 목 전사가 이어진다
      live: "01KH000001003",
      notStarted: "01KH000001003",
      contextNote: "01KH000001003",
      details: "01KH000001001",
    }
  : {
      workspace: "01K0000000000",
      notStarted: "01K0000000005",
      details: "01K0000000002",
      endedDiarized: "01K0000000020",
      paused: "01K0000000006",
      timeline: "01K0000000016",
      contextNote: "01K0000000005",
      reviewing: "01K0000000920",
    };
