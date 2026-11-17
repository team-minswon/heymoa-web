import { faker } from "@faker-js/faker";

import {
  helpDemoPack,
  isHelpDemoEnabled,
} from "@/lib/mocks/help-demo";
import {
  APPROVAL_SCENARIOS,
  SCENARIO_HELP,
  STREAM_SCENARIOS,
  hasScenario,
} from "@/lib/mocks/chat-scenarios";

export type MockSseEvent = { event: string; data: string };

export const GENERAL_CHAT_ANSWERS = [
  "이번 회의에서는 온보딩 이탈과 알림 정책 두 가지를 다뤘습니다. 가입 직후 3분 안에 빠져나가는 비율이 40%를 넘어 프로필 설정 단계를 원인으로 보고, 입력 항목을 여섯 개에서 두 개로 줄이는 안을 검토했습니다. 다음 주 사용자 테스트로 효과를 확인하기로 했습니다.",
  "지금까지 확정된 액션 아이템은 세 건입니다. 온보딩 프로필 항목 축소안 확정, 신규 가입 첫 세션 대상 테스트 시나리오 작성, 테스트 참가자 20명 모집(금요일 마감)입니다. 담당자는 첫 번째 건만 정해졌고 나머지는 아직 언급되지 않았습니다.",
  "알림 논의는 발송 방식에서 시작했습니다. 지금은 이벤트마다 개별 푸시가 나가는데, 하루 알림 수가 많다는 피드백이 반복돼 묶어서 보내는 방향을 검토했습니다. 묶음 기준과 주기를 먼저 정한 뒤 채널별 예외를 다루는 순서가 좋겠다는 의견이 있었습니다.",
  "말씀하신 부분은 회의 후반 08분경에 다뤄졌습니다. 알림 클릭률이 지난 분기 대비 절반 아래로 떨어졌고 알림을 아예 끄는 사용자도 늘고 있어, 정책부터 다시 보기로 했습니다. 구체적인 수치는 스크립트에서 확인할 수 있습니다.",
  "결정과 남은 논의를 나눠 보면, 결정은 온보딩 입력 항목 축소와 사용자 테스트 진행 두 가지입니다. 남은 논의는 알림 묶음 기준과 알림 설정 화면 개선인데, 후자는 다음 사이클 백로그로 넘겼습니다.",
  "해당 안건은 이번 회의 범위에서는 결론이 나지 않았습니다. 테스트 범위를 첫 세션으로 좁힌 결정은 결과 해석을 쉽게 하지만 재방문 시점의 이탈은 확인할 수 없어, 후속 회차가 필요하다는 점이 함께 언급됐습니다.",
];

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

function numericSeed(seed: string) {
  let hash = 7;
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return hash;
}

function pickGeneralAnswer(seed: string) {
  faker.seed(numericSeed(seed));
  return faker.helpers.arrayElement(
    isHelpDemoEnabled() ? helpDemoPack().chatAnswers : GENERAL_CHAT_ANSWERS
  );
}

type BuildInput = {
  chatId: string;
  message: string;
  turn?: number;
  scope?: { kind: "note" | "project"; id: string; title: string }[];
  turnId?: string;
};

const LEAD =
  "지난 회의에서 나온 액션 아이템 하나가 아직 이슈로 남아 있지 않습니다. 담당자와 마감이 이미 정해진 항목이라 그대로 옮겨도 될 것 같아, Linear에 이슈를 만들어 두겠습니다. ";

const TSID_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

export function tsid(seed: string) {
  let hash = 7;
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return Array.from({ length: 13 }, (_, index) => {
    // Math.imul 이어야 합니다. 그냥 곱하면 2^53 을 넘어 하위 비트를 잃고 `>>> 0` 이 0 을 만들어 모든 id 가 같아집니다.
    hash = (Math.imul(hash, 1103515245) + 12345 + index) >>> 0;
    return TSID_ALPHABET[hash % TSID_ALPHABET.length];
  }).join("");
}

function frame(event: string, payload: unknown): MockSseEvent {
  return { event, data: JSON.stringify(payload) };
}

function thinking(...lines: string[]): MockSseEvent[] {
  return lines.map((line) => frame("thinking_delta", { text: `${line}\n` }));
}

const demoText = () => (isHelpDemoEnabled() ? helpDemoPack().chatStream : null);

function scopedNotes(input: BuildInput) {
  const notes = (input.scope ?? []).filter((each) => each.kind === "note");
  return notes.length > 0
    ? notes
    : [{ kind: "note" as const, id: tsid(input.chatId), title: demoText()?.thisNote ?? "이 회의록" }];
}

function scopedNote(input: BuildInput) {
  return scopedNotes(input)[0];
}

function tokens(text: string): MockSseEvent[] {
  return text.split(" ").map((word) => frame("token", { delta: `${word} ` }));
}

export type ApprovalPlan = {
  approvalId: string;
  before: MockSseEvent[];
  after: (decision: "APPROVED" | "REJECTED") => MockSseEvent[];
};

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

function approvalCard(args: Record<string, unknown>) {
  const labels = Array.isArray(args.labels) ? args.labels.join(", ") : null;
  return {
    title: "Linear 이슈 만들기",
    target: "앱 팀",
    fields: [
      { label: "제목", value: String(args.title) },
      ...(labels ? [{ label: "라벨", value: labels }] : []),
    ],
    ...(typeof args.description === "string"
      ? { body: { label: "설명", text: args.description } }
      : {}),
  };
}

export function buildApprovalPlan(input: BuildInput): ApprovalPlan | null {
  if (!APPROVAL_SCENARIOS.some((id) => hasScenario(input.message, id))) {
    return null;
  }
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
        summary: args?.title
          ? `Linear 이슈 '${args.title}' 생성`
          : "Linear 이슈 생성",
        ...(args ? { card: approvalCard(args) } : {}),
      }),
    ],
    after: (decision) => {
      const resolved = frame("tool_approval_resolved", {
        approvalId,
        decision,
      });
      if (decision === "REJECTED") {
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

  if (hasScenario(input.message, "help")) {
    return [
      start,
      ...tokens(SCENARIO_HELP),
      frame("message_end", { messageId, content: SCENARIO_HELP }),
    ];
  }

  if (hasScenario(input.message, "long")) {
    const content = GENERAL_CHAT_ANSWERS.join("\n\n");
    return [
      start,
      ...tokens(content),
      frame("message_end", { messageId, content }),
    ];
  }

  if (hasScenario(input.message, "legacyNarration")) {
    const note = scopedNote(input);
    const content = [
      `${note.title}에서 물어보신 내용을 찾아볼게요.`,
      "스크립트에서 관련 발화를 먼저 확인할게요.",
      pickGeneralAnswer(`${input.chatId}:${input.turn ?? 0}:legacy`),
    ].join("\n\n");
    return [
      start,
      ...tokens(content),
      frame("message_end", { messageId, content, refs: scopedNotes(input) }),
    ];
  }

  if (hasScenario(input.message, "markdown")) {
    return [
      start,
      ...tokens(MARKDOWN_ANSWER),
      frame("message_end", { messageId, content: MARKDOWN_ANSWER }),
    ];
  }

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

  if (hasScenario(input.message, "capacity")) {
    return [
      start,
      ...thinking("스크립트에서 관련 발화를 찾습니다."),
      frame("turn_failed", {
        turnId: input.turnId ?? tsid(`${input.chatId}:${input.turn ?? 0}:turn`),
        code: "CAPACITY_EXCEEDED",
        retryable: true,
      }),
    ];
  }

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
        summary: "스크립트에서 관련 발화 검색",
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
        refs: [pinned, outside],
      }),
    ];
  }

  if (hasScenario(input.message, "multiTool")) {
    const note = scopedNote(input);
    const steps: {
      tool: string;
      summary: string;
      found: string;
      plan: string;
    }[] = [
      {
        tool: "transcripts.search",
        summary: "스크립트에서 결제 실패 언급 검색",
        found: "3건 찾음",
        plan: "먼저 스크립트에서 결제 실패가 언급된 자리를 찾습니다.",
      },
      {
        tool: "notes_read",
        summary: `${note.title} 본문 읽기`,
        found: "요약 + 스크립트 8000자",
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
        const toolCallId = tsid(
          `${input.chatId}:${input.turn ?? 0}:multi:${index}`
        );
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
      ...thinking(
        demoText()?.searching(note.title) ?? `${note.title}에서 물어보신 내용을 찾습니다.`,
        demoText()?.skim ?? "스크립트에서 관련 발화를 먼저 훑겠습니다."
      ),
      frame("tool_call_start", {
        toolCallId,
        tool: "transcripts.search",
        summary: demoText()?.toolSummary ?? "스크립트에서 관련 발화 검색",
        target: { kind: "note", id: note.id, title: note.title },
      }),
      frame("tool_call_result", {
        toolCallId,
        tool: "transcripts.search",
        status: "success",
        summary: demoText()?.found ?? "3건 찾음",
      }),
      ...thinking(demoText()?.composing ?? "찾은 발화로 답을 정리합니다."),
      ...tokens(content),
      frame("message_end", {
        messageId,
        content,
        refs: scopedNotes(input),
      }),
    ];
  }

  const plan = buildApprovalPlan(input)!;
  return [...plan.before, ...plan.after("APPROVED")];
}
