/**
 * agent 채팅 SSE 이벤트 시퀀스를 만드는 순수 함수.
 *
 * 계약은 `docs/contracts/asyncapi-web-server.yml`이고, 스트림은 세 가지로 끝난다 —
 * `message_end`(정상) / `error`(복구 불가) / **종료 이벤트 없이 끊김**. 셋째는 계약이
 * 명시한 경로이며 web이 처리하지 않으면 영원히 로딩이므로 목이 반드시 만들어야 한다.
 *
 * 스트림 전송은 `sse-handler.ts`가 맡는다. 시퀀스 생성과 전송을 나눠 두면 이벤트 순서를
 * 브라우저 없이 테스트할 수 있다.
 */

import { faker } from "@faker-js/faker";

export type MockSseEvent = { event: string; data: string };

/**
 * 일반(도구 없는) 챗 응답 풀. 짧은 고정 한 줄로는 실제 화면 밀도를 볼 수 없어(APP-156),
 * 회의 Q&A 톤의 2~4문장 후보에서 뽑는다. 선택은 입력에서 파생한 시드로 결정적이다 —
 * 같은 질문·턴이면 같은 답, 다른 턴이면 다른 답. 순수 함수를 지키려 매 호출 재시드한다.
 */
export const GENERAL_CHAT_ANSWERS = [
  "이번 회의에서는 온보딩 이탈과 알림 정책 두 가지를 다뤘습니다. 가입 직후 3분 안에 빠져나가는 비율이 40%를 넘어 프로필 설정 단계를 원인으로 보고, 입력 항목을 여섯 개에서 두 개로 줄이는 안을 검토했습니다. 다음 주 사용자 테스트로 효과를 확인하기로 했습니다.",
  "지금까지 확정된 액션 아이템은 세 건입니다. 온보딩 프로필 항목 축소안 확정, 신규 가입 첫 세션 대상 테스트 시나리오 작성, 테스트 참가자 20명 모집(금요일 마감)입니다. 담당자는 첫 번째 건만 정해졌고 나머지는 아직 언급되지 않았습니다.",
  "알림 논의는 발송 방식에서 시작했습니다. 지금은 이벤트마다 개별 푸시가 나가는데, 하루 알림 수가 많다는 피드백이 반복돼 묶어서 보내는 방향을 검토했습니다. 묶음 기준과 주기를 먼저 정한 뒤 채널별 예외를 다루는 순서가 좋겠다는 의견이 있었습니다.",
  "말씀하신 부분은 회의 후반 08분경에 다뤄졌습니다. 알림 클릭률이 지난 분기 대비 절반 아래로 떨어졌고 알림을 아예 끄는 사용자도 늘고 있어, 정책부터 다시 보기로 했습니다. 구체적인 수치는 전사 기록에서 확인할 수 있습니다.",
  "결정과 남은 논의를 나눠 보면, 결정은 온보딩 입력 항목 축소와 사용자 테스트 진행 두 가지입니다. 남은 논의는 알림 묶음 기준과 알림 설정 화면 개선인데, 후자는 다음 사이클 백로그로 넘겼습니다.",
  "해당 안건은 이번 회의 범위에서는 결론이 나지 않았습니다. 테스트 범위를 첫 세션으로 좁힌 결정은 결과 해석을 쉽게 하지만 재방문 시점의 이탈은 확인할 수 없어, 후속 회차가 필요하다는 점이 함께 언급됐습니다.",
];

/** 문자열 시드를 faker용 32비트 정수로. tsid와 같은 방식이라 결정적이다. */
function numericSeed(seed: string) {
  let hash = 7;
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return hash;
}

function pickGeneralAnswer(seed: string) {
  faker.seed(numericSeed(seed));
  return faker.helpers.arrayElement(GENERAL_CHAT_ANSWERS);
}

type BuildInput = {
  chatId: string;
  message: string;
  /** 턴 번호. 같은 채팅의 다음 응답이 앞 응답의 id를 재사용하지 않게 한다. */
  turn?: number;
};

/** 승인 흐름의 첫 조각. 승인 전에 이미 흘러간 텍스트라 최종 content의 앞머리이기도 하다. */
const LEAD = "Linear에 ";

const TSID_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

/**
 * 13자 TSID를 결정적으로 만든다.
 *
 * 계약이 요구하는 형식이라 어기면 server가 승인 row 등록을 건너뛰고 승인 API가 404가 된다.
 * 무작위로 만들면 테스트가 흔들리므로 seed에서 뽑는다.
 */
function tsid(seed: string) {
  let hash = 7;
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return Array.from({ length: 13 }, (_, index) => {
    hash = (hash * 1103515245 + 12345 + index) >>> 0;
    return TSID_ALPHABET[hash % TSID_ALPHABET.length];
  }).join("");
}

function frame(event: string, payload: unknown): MockSseEvent {
  return { event, data: JSON.stringify(payload) };
}

function tokens(text: string): MockSseEvent[] {
  return text.split(" ").map((word) => frame("token", { delta: `${word} ` }));
}

/**
 * 승인이 필요한 스트림의 조각. 핸들러가 `before`를 흘리고 승인을 **기다린** 뒤,
 * 결정에 따라 `after(decision)`를 이어 흘린다. 목이 스스로 승인해 버리면 web은
 * 승인 대기 UI도 거절 경로도 밟을 수 없다.
 */
export type ApprovalPlan = {
  approvalId: string;
  before: MockSseEvent[];
  after: (decision: "APPROVED" | "REJECTED") => MockSseEvent[];
};

export function buildApprovalPlan(input: BuildInput): ApprovalPlan | null {
  if (!input.message.includes("이슈")) return null;
  if (
    input.message.includes("연결을 끊어줘") ||
    input.message.includes("장애를 재현해줘")
  ) {
    return null;
  }

  const seed = `${input.chatId}:${input.turn ?? 0}`;
  const messageId = tsid(`${seed}:message`);
  const approvalId = tsid(`${seed}:approval`);
  const toolCallId = tsid(`${seed}:call`);

  return {
    approvalId,
    before: [
      frame("message_start", { chatId: input.chatId, messageId }),
      ...tokens(LEAD.trimEnd()),
      frame("tool_approval_request", {
        approvalId,
        toolCallId,
        tool: "linear.create_issue",
        summary: "Linear 이슈 'APP 버그 수정' 생성",
      }),
    ],
    after: (decision) => {
      const resolved = frame("tool_approval_resolved", { approvalId, decision });
      // 토큰을 이어붙인 결과는 message_end.content와 같아야 한다 (계약). 다르면 스트리밍
      // 중 보이던 글이 새로고침 후 다른 글로 바뀐다. 그래서 둘을 같은 원본에서 만든다.
      if (decision === "REJECTED") {
        // 거절이면 도구를 실행하지 않고 agent가 그걸 반영해 응답을 이어간다.
        // 스트림은 여전히 정상 종료된다 (계약).
        const rest = "요청하신 이슈 생성은 취소했습니다.";
        return [
          resolved,
          ...tokens(rest),
          frame("message_end", { messageId, content: LEAD + rest }),
        ];
      }
      const rest = "이슈 APP-12를 만들었습니다.";
      return [
        resolved,
        frame("tool_call_result", {
          toolCallId,
          status: "success",
          summary: "APP-12 생성됨",
          url: "https://linear.app/heymoa/issue/APP-12",
        }),
        ...tokens(rest),
        frame("message_end", { messageId, content: LEAD + rest }),
      ];
    },
  };
}

export function buildChatEvents(input: BuildInput): MockSseEvent[] {
  const messageId = tsid(`${input.chatId}:${input.turn ?? 0}:message`);
  const start = frame("message_start", {
    chatId: input.chatId,
    messageId,
  });

  // 데모에서 실패 경로를 직접 밟을 수 있게 메시지로 분기한다.
  if (input.message.includes("연결을 끊어줘")) {
    return [start, ...tokens("응답을 만들던 중")];
  }

  if (input.message.includes("장애를 재현해줘")) {
    return [
      start,
      ...tokens("응답을 만들던 중"),
      frame("error", {
        code: "LLM_PROVIDER_ERROR",
        message: "응답 생성에 실패했습니다. 잠시 후 다시 시도해 주세요.",
      }),
    ];
  }

  if (!input.message.includes("이슈")) {
    const content = pickGeneralAnswer(
      `${input.chatId}:${input.turn ?? 0}:${input.message}`
    );
    return [
      start,
      ...tokens(content),
      frame("message_end", { messageId, content }),
    ];
  }

  // 승인 흐름은 plan으로 만든다. 이 함수는 "승인됐다면" 어떤 시퀀스인지를 돌려주며,
  // 실제 대기는 sse-handler가 한다.
  const plan = buildApprovalPlan(input)!;
  return [...plan.before, ...plan.after("APPROVED")];
}
