export const CHAT_SCENARIOS = {
  help: {
    keyword: "시나리오",
    kind: "stream",
    what: "이 목록. 목이 자기 사용법을 답한다",
  },
  approval: {
    keyword: "이슈",
    kind: "stream",
    what: "쓰기 도구 승인 카드. 1차는 카드에서 끝나고 **승인 응답이 2차 스트림**이다",
  },
  longArgs: {
    keyword: "긴 설명",
    kind: "stream",
    what: "승인 카드의 본문이 **여러 줄로 길다.** 접히는지, 아니면 카드가 화면을 밀어내는지",
  },
  noArgs: {
    keyword: "인자 없이",
    kind: "stream",
    what: "카드 구조 없이 `summary` 만 오는 쓰기 도구. **빈 칸이 흉하게 남지 않는지**",
  },
  multiTool: {
    keyword: "여러 번",
    kind: "stream",
    what: "도구를 세 번 부르는 턴. 생각이 도구마다 하나씩 붙어 **단계가 쌓인 모습**",
  },
  widened: {
    keyword: "범위 밖",
    kind: "stream",
    what: "붙인 회의록에 없어 **밖까지 넓혀서** 답한 턴. 근거 줄에 범위 밖 회의록이 서는지",
  },
  slow: {
    keyword: "천천히",
    kind: "transport",
    what: "각 스트림의 첫 프레임 전 3초 침묵. **승인을 누른 뒤 2차에도 걸린다** — 「이슈」와 섞어 쓴다",
  },
  long: {
    keyword: "길게",
    kind: "stream",
    what: "아주 긴 답. 스크롤이 따라붙는지와 「중지」를 누를 틈이 있는지 보는 자리",
  },
  markdown: {
    keyword: "마크다운",
    kind: "stream",
    what: "제목 세 층·표·코드블록·긴 URL이 든 답. **좁은 패널에서 무엇이 넘치는지** 보는 자리",
  },
  conflict: {
    keyword: "겹쳐서",
    kind: "transport",
    what: "다른 탭이 이미 턴을 돌고 있다(409). 문장이 컴포저로 되돌아오고 오류 배너는 안 뜬다",
  },
  capacity: {
    keyword: "용량",
    kind: "stream",
    what: "`turn_failed(CAPACITY_EXCEEDED)`. `error` 없이 턴만 실패로 굳는다",
  },
  failure: {
    keyword: "장애를 재현해줘",
    kind: "stream",
    what: "`error` 뒤 `turn_failed`. 복구 불가 실패",
  },
  disconnect: {
    keyword: "연결을 끊어줘",
    kind: "stream",
    what: "종료 이벤트 없이 끊긴다 — 계약이 말하는 셋째 종료",
  },
  zombie: {
    keyword: "좀비",
    kind: "transport",
    what: "턴만 서고 이벤트가 하나도 안 온다. 굳혀 주는 것이 없으면 무한 스피너",
  },
  stall: {
    keyword: "멈칫",
    kind: "transport",
    what: "도구 결과 앞에서 25초 동안 아무 이벤트도 안 온다. 진행 줄이 「응답이 늦어지고 있어요」로 바뀌었다가 이벤트가 오면 돌아오는지",
  },
  legacyNarration: {
    keyword: "옛 방식",
    kind: "stream",
    what: "진행 문장이 생각(thinking)이 아니라 **본문 token** 으로 오던 옛 ai. 옛 대화가 그 모양 그대로 그려지는지",
  },
  resync: {
    keyword: "밀리게 해줘",
    kind: "transport",
    what: "첫 연결이 두 프레임 뒤에 끊기고 턴은 곧바로 끝난다. 재접속이 **410** 을 받아 화면이 히스토리를 다시 읽는 자리",
  },
} as const satisfies Record<
  string,
  { keyword: string; kind: "stream" | "transport"; what: string }
>;

type ScenarioId = keyof typeof CHAT_SCENARIOS;

const IDS = Object.keys(CHAT_SCENARIOS) as ScenarioId[];

export function hasScenario(message: string, id: ScenarioId): boolean {
  return message.includes(CHAT_SCENARIOS[id].keyword);
}

export const STREAM_SCENARIOS = IDS.filter(
  (id) => CHAT_SCENARIOS[id].kind === "stream"
);

export const APPROVAL_SCENARIOS = [
  "longArgs",
  "noArgs",
  "approval",
] as const satisfies readonly ScenarioId[];

export function leadSilenceMs(message: string): number {
  return hasScenario(message, "slow") ? 3_000 : 0;
}

export function stallSilenceMs(message: string, event: string): number {
  return hasScenario(message, "stall") && event === "tool_call_result"
    ? 25_000
    : 0;
}

export const SCENARIO_HELP = [
  "이 화면은 목(MSW)으로 돕니다. 메시지에 아래 키워드를 넣으면 그 상황이 재현됩니다.",
  "",
  ...IDS.map(
    (id) => `- \`${CHAT_SCENARIOS[id].keyword}\` — ${CHAT_SCENARIOS[id].what}`
  ),
  "",
  '스트림이 느리면 콘솔에서 `localStorage.mockChatSpeed = "4"`로 배속을 올릴 수 있습니다.',
].join("\n");
