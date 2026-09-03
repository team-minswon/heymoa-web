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

import {
  APPROVAL_SCENARIOS,
  SCENARIO_HELP,
  STREAM_SCENARIOS,
  hasScenario,
} from "@/lib/mocks/chat-scenarios";

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

/**
 * 마크다운이 실제로 낼 수 있는 모양을 **한 답에 모아 둔 것.**
 *
 * 채팅 패널은 좁다(448px 중 본문 열은 약 398px). 여기서 화면을 미는 것은 늘 같은 셋이다 —
 * **표, 긴 코드 줄, 끊을 자리가 없는 URL.** 짧은 답으로는 셋 다 안 나온다.
 *
 * 스트리밍으로 흘려야 의미가 있다: 토큰마다 다시 파싱되는 동안 반쯤 온 표와 아직 안 닫힌
 * 코드펜스가 화면을 깨뜨리지 않는지, 낱말 페이드가 표 셀·코드블록에서 어떻게 노는지가
 * 여기서만 보인다.
 */
const MARKDOWN_ANSWER = [
  "# 온보딩 이탈 정리",
  "",
  "회의에서 다룬 것을 **결정**과 *남은 논의*로 나눠 적었습니다.",
  "",
  "## 결정된 것",
  "",
  "1. 프로필 입력 항목을 여섯 개에서 두 개로 줄입니다",
  "2. 다음 주에 사용자 테스트를 돌립니다",
  "   - 대상은 신규 가입 첫 세션",
  "   - 참가자 20명, 금요일 모집 마감",
  "3. 알림 묶음 기준은 다음 사이클로 넘깁니다",
  "",
  "### 구간별 이탈률",
  "",
  "| 단계 | 진입 | 이탈 | 비고 |",
  "| --- | --- | --- | --- |",
  "| 가입 폼 | 1,240 | 12% | 이메일 인증 대기에서 절반 |",
  "| 프로필 설정 | 1,091 | 41% | 여기가 제일 큽니다 |",
  "| 첫 회의 생성 | 644 | 9% | |",
  "",
  "## 남은 논의",
  "",
  "> 알림을 아예 끄는 사용자가 늘고 있습니다. 정책부터 다시 보기로 했습니다.",
  "",
  "- [x] 이탈 구간 확인",
  "- [x] 축소안 초안",
  "- [ ] 알림 묶음 기준",
  // ★ **체크박스를 품은 위 단계.** 「체크박스 줄만 표식을 뗀다」가 실제로 그 줄에만
  // 걸리는지는 이 모양에서만 갈린다 — 자손까지 보는 규칙이면 「설정 화면 개선」의
  // 불릿이 같이 사라진다.
  "- 설정 화면 개선",
  "  - [ ] `notification_preferences` 스키마 확정",
  "",
  "확인용 질의는 아래와 같습니다. `event_name` 필터를 빼면 전 구간이 섞입니다.",
  "",
  "```sql",
  "SELECT step, count(*) AS entered, round(100.0 * sum(dropped) / count(*), 1) AS drop_rate FROM onboarding_funnel WHERE event_name = 'profile_setup' AND occurred_at >= now() - interval '30 days' GROUP BY step ORDER BY step;",
  "```",
  "",
  "---",
  "",
  "원본 대시보드: https://analytics.example.com/dashboards/onboarding-funnel/v3?range=30d&segment=new_users&compare=previous_period&breakdown=step",
].join("\n");

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
  /**
   * 이 턴에 붙은 범위(제목이 있는 것만). 생각 문장과 도구 `target`이 이 이름을 쓴다 —
   * 「무엇을 보고 있나」가 화면에 뜨는 자리라, 목이 아무 이름이나 지어내면 그 자리가
   * 검증이 안 된다.
   */
  scope?: { kind: "note" | "project"; id: string; title: string }[];
  /** 이 턴의 id. `turn_failed`가 계약상 요구한다. 없으면 시드에서 만든다. */
  turnId?: string;
  /**
   * 범위 밖 시나리오가 제안할 **더 넓은 곳**. `sse-handler`가 실재하는 프로젝트로 채운다 —
   * 지어낸 id를 주면 버튼을 눌렀을 때 「사용할 수 없음」 칩이 붙어 확장이 거기서 끊긴다.
   */
};

/**
 * 승인 흐름의 첫 조각. 승인 전에 이미 흘러간 텍스트라 최종 content의 앞머리이기도 하다.
 *
 * ★ **사람이 읽고 판단할 만한 길이여야 한다.** 예전에는 「Linear에 」 두 낱말만 흘리고
 * 곧바로 승인 카드를 냈다. 그래서 카드가 설명 없이 튀어나온 것처럼 보였는데, 앱이 아니라
 * **목이 얇아서** 생긴 모습이었다. 무엇을 왜 하려는지가 카드 위에 서 있어야 「승인」이
 * 판단이 된다.
 *
 * 끝의 공백은 일부러다 — `LEAD + rest`가 최종 content이고 승인 뒤 이어지는 문장과 붙는다.
 */
const LEAD =
  "지난 회의에서 나온 액션 아이템 하나가 아직 이슈로 남아 있지 않습니다. 담당자와 마감이 이미 정해진 항목이라 그대로 옮겨도 될 것 같아, Linear에 이슈를 만들어 두겠습니다. ";

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
    // ★ **`Math.imul` 이어야 한다.** `hash * 1103515245` 는 2^53 을 넘어 float 이 하위
    // 비트를 잃고, `>>> 0` 이 그걸 **0으로** 만든다. 그러면 `0 % 32` 가 늘 0 이라
    // 모든 id 가 `0000000000000` 이 됐다 — 형식은 계약을 지켜서 아무도 안 걸렸고,
    // 대화 하나에서 승인을 두 번 받으면 두 번째 카드가 **누르기도 전에 잠겨** 있었다.
    hash = (Math.imul(hash, 1103515245) + 12345 + index) >>> 0;
    return TSID_ALPHABET[hash % TSID_ALPHABET.length];
  }).join("");
}

function frame(event: string, payload: unknown): MockSseEvent {
  return { event, data: JSON.stringify(payload) };
}

/**
 * 생각 문장. **`token`이 아니라 `thinking_delta`다** — 계획은 답이 아니라서 갈라 보낸다.
 * 한 문장이 한 프레임이고, 화면은 이걸 「생각」 묶음으로 접는다.
 */
/**
 * 연속된 `thinking_delta`는 리듀서가 **한 블록으로 이어붙인다**(`appendThinking`).
 * 그래서 생각이 둘이면 사이에 줄바꿈을 넣어야 한다 — 안 넣으면 화면에
 * 「찾습니다.전사에서」처럼 두 문장이 붙어 버린다.
 */
function thinking(...lines: string[]): MockSseEvent[] {
  return lines.map((line, index) =>
    frame("thinking_delta", { text: index === 0 ? line : `\n${line}` })
  );
}

/**
 * 이 턴이 본 회의록 전부. **붙인 것이 여럿이면 여럿을 돌려준다.**
 *
 * 근거 묶음의 두 얼굴 — 「찾은 곳: … 1건」(펼침)과 「이 답은 N개 회의를 봤습니다」(접힘) —
 * 중 뒤쪽은 목에서 한 번도 볼 수 없었다. 답이 늘 회의록 하나만 봤기 때문이다. @ 로 둘
 * 이상 붙이면 이제 그 자리가 뜬다. 지어낸 이름이 아니라 **실제로 붙인 것**이라 도구
 * `target` 과도 안 어긋난다.
 */
function scopedNotes(input: BuildInput) {
  const notes = (input.scope ?? []).filter((each) => each.kind === "note");
  return notes.length > 0
    ? notes
    : [{ kind: "note" as const, id: tsid(input.chatId), title: "이 회의록" }];
}

/** 하나만 들어가는 자리(생각 문장·도구 `target`)가 쓴다. */
function scopedNote(input: BuildInput) {
  return scopedNotes(input)[0];
}

function tokens(text: string): MockSseEvent[] {
  return text.split(" ").map((word) => frame("token", { delta: `${word} ` }));
}

/**
 * 승인이 필요한 스트림의 조각. **두 번에 나눠 흘린다** — `before`가 `tool_approval_request`로
 * 끝나 스트림이 닫히면, 승인 API 의 202 뒤 같은 턴 스트림에 `after(decision)`가 이어진다.
 * 목이 스스로 승인해 버리면 web은 승인 대기 UI도 거절 경로도 밟을 수 없다.
 */
export type ApprovalPlan = {
  approvalId: string;
  before: MockSseEvent[];
  after: (decision: "APPROVED" | "REJECTED") => MockSseEvent[];
};

/**
 * 승인 카드가 보여줄 인자 세 모양. **눈으로 갈리는 자리가 여기다.**
 *
 * 한 줄로 다 보이는 것 · 접어야 하는 것 · 아예 없는 것. 셋을 다 안 지나면 카드가
 * 「길면 접는다」와 「비면 안 그린다」 중 어느 쪽도 검증된 적이 없는 채로 남는다.
 */
function approvalArgs(message: string): Record<string, unknown> | null {
  if (hasScenario(message, "noArgs")) return null;
  if (hasScenario(message, "longArgs")) {
    return {
      projectId: "0HZX2K7M9Q4AE",
      title: "결제 실패율 3% 급증 원인 파악",
      description: [
        "어제 회의에서 결제 실패율이 3%로 올랐다는 얘기가 나왔습니다.",
        "",
        "확인할 것",
        "- 실패 코드 분포를 먼저 본다",
        "- PG 응답 지연과 겹치는 구간이 있는지 본다",
        "- 재시도 정책이 실패를 부풀리고 있지는 않은지 본다",
        "",
        "이틀 전 회의에서도 같은 얘기가 나왔지만 그때는 원인을 못 좁혔습니다.",
      ].join("\n"),
      labels: ["bug", "payments"],
    };
  }
  return { projectId: "0HZX2K7M9Q4AE", title: "APP 버그 수정" };
}

export function buildApprovalPlan(input: BuildInput): ApprovalPlan | null {
  if (!APPROVAL_SCENARIOS.some((id) => hasScenario(input.message, id))) {
    return null;
  }
  // 시퀀스를 통째로 바꾸는 시나리오가 섞였으면 그쪽이 이긴다. 전송만 바꾸는 시나리오
  // (버퍼·재싱크·지연)는 섞여도 된다 — 「승인 대기 중에 버퍼를 비운다」가 볼 만한 조합이다.
  if (
    STREAM_SCENARIOS.some(
      (id) =>
        !APPROVAL_SCENARIOS.includes(
          id as (typeof APPROVAL_SCENARIOS)[number]
        ) && hasScenario(input.message, id)
    )
  ) {
    return null;
  }

  const seed = `${input.chatId}:${input.turn ?? 0}`;
  const messageId = tsid(`${seed}:message`);
  const approvalId = tsid(`${seed}:approval`);
  const toolCallId = tsid(`${seed}:call`);

  const note = scopedNote(input);
  const args = approvalArgs(input.message);
  return {
    approvalId,
    before: [
      frame("message_start", { chatId: input.chatId, messageId }),
      ...thinking(
        `${note.title}에서 이슈로 만들 만한 것을 고릅니다.`,
        "쓰기 도구라 실행 전에 승인을 받겠습니다."
      ),
      ...tokens(LEAD.trimEnd()),
      // ★ **인자를 나르는 것은 이 프레임뿐이다.** 예전 목은 이걸 아예 안 냈고, 그래서
      // 「승인 카드가 인자를 이어받는가」를 목으로는 한 번도 못 봤다. 계약(ai)은 쓰기
      // 도구에도 이것을 먼저 낸다 — 목이 계약보다 적게 내면 앱의 결함이 안 보인다.
      frame("tool_call_start", {
        toolCallId,
        tool: "linear.create_issue",
        summary: "Linear 이슈 생성",
        ...(args ? { args } : {}),
      }),
      frame("tool_approval_request", {
        approvalId,
        toolCallId,
        tool: "linear.create_issue",
        // **요약과 인자를 같은 원본에서 만든다.** 갈리면 카드가 한 줄로는 A 를 만든다고
        // 하고 그 아래 인자에는 B 가 적혀 사람이 무엇을 믿을지 모른다.
        summary: args?.title
          ? `Linear 이슈 '${args.title}' 생성`
          : "Linear 이슈 생성",
      }),
    ],
    after: (decision) => {
      const resolved = frame("tool_approval_resolved", {
        approvalId,
        decision,
      });
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
        // **`tool_call_start`가 없다.** 계약상 2차에는 안 온다 — 도구 이름은 승인
        // 요청이 이미 말했고, 결과 tee는 그 이름으로 귀속한다(`sse-handler`).
        frame("tool_call_result", {
          toolCallId,
          status: "success",
          summary: "APP-12 생성됨",
          url: "https://linear.app/heymoa/issue/APP-12",
        }),
        ...tokens(rest),
        frame("message_end", {
          messageId,
          content: LEAD + rest,
          refs: scopedNotes(input),
        }),
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

  // 목이 자기 사용법을 답한다. 코드를 읽어야만 무엇을 칠 수 있는지 알던 것을 없앤다.
  // **제일 먼저 본다** — 「이슈 시나리오 알려줘」는 승인이 아니라 안내를 물은 것이다.
  if (hasScenario(input.message, "help")) {
    return [
      start,
      ...tokens(SCENARIO_HELP),
      frame("message_end", { messageId, content: SCENARIO_HELP }),
    ];
  }

  /**
   * 아주 긴 답. **화면이 갈리는 자리는 둘이다** — 답이 자라는 동안 스크롤이 따라붙는가,
   * 그리고 「중지」를 누를 틈이 있는가. 짧은 답으로는 둘 다 스쳐 지나간다.
   */
  if (hasScenario(input.message, "long")) {
    const content = GENERAL_CHAT_ANSWERS.join("\n\n");
    return [
      start,
      ...tokens(content),
      frame("message_end", { messageId, content }),
    ];
  }

  // 마크다운이 낼 수 있는 모양을 한 답에 모아 흘린다. 좁은 패널에서 넘치는 것과
  // 반쯤 온 표·코드펜스가 여기서 보인다.
  if (hasScenario(input.message, "markdown")) {
    return [
      start,
      ...tokens(MARKDOWN_ANSWER),
      frame("message_end", { messageId, content: MARKDOWN_ANSWER }),
    ];
  }

  // 데모에서 실패 경로를 직접 밟을 수 있게 메시지로 분기한다.
  if (hasScenario(input.message, "disconnect")) {
    return [start, ...tokens("응답을 만들던 중")];
  }

  if (hasScenario(input.message, "failure")) {
    return [
      start,
      ...tokens("응답을 만들던 중"),
      frame("error", {
        code: "LLM_PROVIDER_ERROR",
        message: "응답 생성에 실패했습니다. 잠시 후 다시 시도해 주세요.",
      }),
    ];
  }

  /**
   * **`error` 없이 `turn_failed`만 오는 갈래.** 계약이 열어 둔 경로이고(스트림을 열기 전
   * 거절), web이 이 갈래를 안 열면 EOF까지 로딩으로 남는다. 생각 블록은 남고 배너가 선다.
   */
  if (hasScenario(input.message, "capacity")) {
    return [
      start,
      ...thinking("전사에서 관련 발화를 찾습니다."),
      frame("turn_failed", {
        turnId: input.turnId ?? tsid(`${input.chatId}:${input.turn ?? 0}:turn`),
        code: "CAPACITY_EXCEEDED",
        retryable: true,
      }),
    ];
  }

  /**
   * ★ **범위 밖까지 넓혀서 답한 턴.**
   *
   * 범위는 담장이 아니라 먼저 볼 곳이라, 붙인 회의록에 답이 없으면 에이전트가
   * 워크스페이스 안에서 더 찾는다. **넓혔다는 사실을 알리는 자리가 `refs` 하나뿐이라**
   * (묻는 카드가 없다) 그 목록에 범위 밖 회의록이 서는지를 이 시나리오가 보여준다.
   *
   * 예전에는 여기서 「더 넓게 찾아볼까요?」 카드가 떴다. 물을 시점에는 이미 넘어가 본
   * 뒤라 그 카드가 묻는 카드로서 뜻을 잃었다.
   */
  if (hasScenario(input.message, "widened")) {
    const pinned = scopedNote(input);
    const outside = {
      kind: "note" as const,
      id: tsid(`${input.chatId}:outside`),
      title: "결제 개편 킥오프",
    };
    const content = `${pinned.title}에는 그 얘기가 없고, ${outside.title}에서 정해졌습니다.`;
    const toolCallId = tsid(`${input.chatId}:${input.turn ?? 0}:widen`);
    return [
      start,
      ...thinking("붙인 회의록을 먼저 보고, 없으면 더 찾습니다."),
      frame("tool_call_start", {
        toolCallId,
        tool: "transcripts.search",
        summary: "전사에서 관련 발화 검색",
        target: pinned,
      }),
      frame("tool_call_result", {
        toolCallId,
        tool: "transcripts.search",
        status: "success",
        summary: `${outside.title}에서 1건`,
      }),
      ...tokens(content),
      frame("message_end", {
        messageId,
        content,
        // **범위 밖 회의록이 여기 선다.** 이것이 곧 「넓혔습니다」다.
        refs: [pinned, outside],
      }),
    ];
  }

  /**
   * 도구를 세 번 부르는 턴. **생각이 도구마다 하나씩 붙는다.**
   *
   * 다른 시나리오는 도구가 한 번뿐이라 묶음이 두세 줄에서 끝났다 — 접이식 서랍이
   * 실제로 필요해지는 길이와, 헤더의 「N단계」가 무엇을 세는지가 여기서만 보인다.
   */
  if (hasScenario(input.message, "multiTool")) {
    const note = scopedNote(input);
    const steps: { tool: string; summary: string; found: string; plan: string }[] =
      [
        {
          tool: "transcripts.search",
          summary: "전사에서 결제 실패 언급 검색",
          found: "3건 찾음",
          plan: "먼저 전사에서 결제 실패가 언급된 자리를 찾습니다.",
        },
        {
          tool: "notes_read",
          summary: `${note.title} 본문 읽기`,
          found: "요약 + 전사 8000자",
          plan: "찾은 대목이 어느 회의인지 확인하려고 그 회의록을 폅니다.",
        },
        {
          tool: "linear.search_issues",
          summary: "Linear 에 같은 이슈가 있나 검색",
          found: "1건 찾음",
          plan: "같은 얘기로 이미 만들어 둔 이슈가 있는지 봅니다.",
        },
      ];
    const content =
      "두 회의에서 나왔고, 이슈는 APP-12 로 이미 만들어져 있습니다. 새로 만들지 않았습니다.";
    return [
      start,
      ...steps.flatMap((step, index) => {
        const toolCallId = tsid(`${input.chatId}:${input.turn ?? 0}:multi:${index}`);
        return [
          ...thinking(step.plan),
          frame("tool_call_start", {
            toolCallId,
            tool: step.tool,
            summary: step.summary,
            target: { kind: "note", id: note.id, title: note.title },
          }),
          frame("tool_call_result", {
            toolCallId,
            tool: step.tool,
            status: "success",
            summary: step.found,
          }),
        ];
      }),
      ...thinking("셋을 합쳐 답을 정리합니다."),
      ...tokens(content),
      frame("message_end", { messageId, content, refs: scopedNotes(input) }),
    ];
  }

  if (!APPROVAL_SCENARIOS.some((id) => hasScenario(input.message, id))) {
    const content = pickGeneralAnswer(
      `${input.chatId}:${input.turn ?? 0}:${input.message}`
    );
    const note = scopedNote(input);
    const toolCallId = tsid(`${input.chatId}:${input.turn ?? 0}:search`);
    return [
      start,
      // **한 턴이 지나는 길을 그대로 흘린다.** 생각 → 도구 시작 → 도구 결과 → 답.
      // 이 넷이 없으면 진행 표시가 화면에 붙었는지 목으로 확인할 방법이 없다.
      ...thinking(
        `${note.title}에서 물어보신 내용을 찾습니다.`,
        "전사에서 관련 발화를 먼저 훑겠습니다."
      ),
      frame("tool_call_start", {
        toolCallId,
        tool: "transcripts.search",
        summary: "전사에서 관련 발화 검색",
        target: { kind: "note", id: note.id, title: note.title },
      }),
      frame("tool_call_result", {
        toolCallId,
        tool: "transcripts.search",
        status: "success",
        summary: "3건 찾음",
      }),
      ...thinking("찾은 발화로 답을 정리합니다."),
      ...tokens(content),
      frame("message_end", {
        messageId,
        content,
        // 「찾은 곳」 줄이 스트림에서도 뜨는지 보려면 여기 실려야 한다. 히스토리로
        // 넘어간 뒤에야 뜨면 답이 끝나는 순간 없던 줄이 끼어든 것처럼 보인다.
        refs: scopedNotes(input),
      }),
    ];
  }

  // 승인 흐름은 plan으로 만든다. 이 함수는 "승인됐다면" 어떤 시퀀스인지를 돌려주며,
  // 실제 대기는 sse-handler가 한다.
  const plan = buildApprovalPlan(input)!;
  return [...plan.before, ...plan.after("APPROVED")];
}
