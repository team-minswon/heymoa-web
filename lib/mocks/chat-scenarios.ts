/**
 * 목이 재현하는 상황 표. **키워드는 여기 한 곳에만 적힌다.**
 *
 * 예전에는 문자열이 `chat-stream.ts`와 `sse-handler.ts`에 흩어져 있어서, 무엇을 쳐야
 * 어떤 화면을 볼 수 있는지 알려면 두 파일을 읽어야 했다. 표가 정본이고 두 파일이 이걸
 * 참조한다 — `"시나리오"` 답변도 이 표에서 만들어지므로 표를 늘리면 안내도 같이 는다.
 *
 * `kind`는 **갈리는 자리**를 말한다.
 * - `stream` — 이벤트 시퀀스 자체가 달라진다 (`chat-stream.ts`)
 * - `transport` — 시퀀스는 그대로고 전송·연결이 달라진다 (`sse-handler.ts`)
 *
 * 승인 흐름은 다른 `stream` 시나리오와 섞이면 자리를 내준다(`STREAM_SCENARIOS`).
 * `transport`는 섞여도 된다 — 「승인 대기 중에 버퍼를 비운다」가 실제로 보고 싶은 조합이다.
 */
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
    what: "승인 카드의 인자가 **여러 줄로 길다.** 접히는지, 아니면 카드가 화면을 밀어내는지",
  },
  noArgs: {
    keyword: "인자 없이",
    kind: "stream",
    what: "인자가 아예 없는 쓰기 도구. **빈 칸이 흉하게 남지 않는지**",
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
  resync: {
    keyword: "밀리게 해줘",
    kind: "transport",
    what: "첫 연결이 두 프레임 뒤에 끊기고 턴은 곧바로 끝난다. 재접속이 **410** 을 받아 화면이 히스토리를 다시 읽는 자리",
  },
} as const satisfies Record<
  string,
  { keyword: string; kind: "stream" | "transport"; what: string }
>;

export type ScenarioId = keyof typeof CHAT_SCENARIOS;

const IDS = Object.keys(CHAT_SCENARIOS) as ScenarioId[];

/** 이 메시지가 그 시나리오를 켰나. 키워드 문자열을 바깥에서 다시 적지 않는다. */
export function hasScenario(message: string, id: ScenarioId): boolean {
  return message.includes(CHAT_SCENARIOS[id].keyword);
}

/**
 * 시퀀스를 통째로 바꾸는 시나리오들. `"이슈"`가 든 메시지라도 이 중 하나가 섞여 있으면
 * 승인 흐름이 아니다 — 그쪽이 이긴다.
 */
export const STREAM_SCENARIOS = IDS.filter(
  (id) => CHAT_SCENARIOS[id].kind === "stream"
);

/**
 * 승인 흐름의 갈래들. **서로는 배타지만 위 「그쪽이 이긴다」 규칙에서는 빠진다** —
 * 셋 다 같은 승인 시퀀스의 인자만 바꾼 것이라, 서로를 승인 아닌 것으로 보면 안 된다.
 *
 * 앞에 있는 것이 이긴다. `"긴 설명으로 이슈 만들어줘"`처럼 둘이 섞여도 판정이 하나다.
 */
export const APPROVAL_SCENARIOS = [
  "longArgs",
  "noArgs",
  "approval",
] as const satisfies readonly ScenarioId[];

/**
 * 첫 프레임 앞의 침묵(ms). 평소에는 0이고 `"천천히"`만 사람이 볼 수 있는 길이로 늘린다 —
 * 그 구간의 화면은 `groups.length === 0`이라 아무것도 안 그린다(`chat-thread.tsx`).
 */
export function leadSilenceMs(message: string): number {
  return hasScenario(message, "slow") ? 3_000 : 0;
}

/**
 * `"시나리오"`라고 치면 목이 답하는 글. **표에서 만든다** — 손으로 적으면 표와 갈린다.
 *
 * 줄 끝 공백과 이중 공백을 넣지 않는다: 토큰을 이어붙인 결과가 `message_end.content`와
 * 같아야 한다는 계약을 목 스스로 지켜야 해서다.
 */
export const SCENARIO_HELP = [
  "이 화면은 목(MSW)으로 돕니다. 메시지에 아래 키워드를 넣으면 그 상황이 재현됩니다.",
  "",
  ...IDS.map((id) => `- \`${CHAT_SCENARIOS[id].keyword}\` — ${CHAT_SCENARIOS[id].what}`),
  "",
  "스트림이 느리면 콘솔에서 `localStorage.mockChatSpeed = \"4\"`로 배속을 올릴 수 있습니다.",
].join("\n");
