import type { StoreState } from "@/lib/mocks/db";
import { HD_NOTE_IDS, NOTE_DEFS } from "@/lib/mocks/help-demo/notes";
import { HD_ME, HD_MEMBERS, HD_PRACTICE_WORKSPACE_ID, HD_WORKSPACE_ID } from "@/lib/mocks/help-demo/people";

/** 용어 사전. 쉼표 일괄 등록 시연용 「코호트, 리텐션, 이탈률」은 일부러 넣지 않는다. */
export const HELP_DEMO_TERMS = [
  "ROAS", "CTR", "CPC", "CPA", "전환율", "리타겟팅", "퍼널", "OKR", "KPI", "A/B 테스트",
  "랜딩 페이지", "브랜드 가이드", "CRM", "리드", "온보딩", "세그먼트", "키비주얼", "톤앤매너",
  "인플루언서", "어트리뷰션", "장바구니 이탈", "사전 신청", "상세 페이지", "소재", "마지막 클릭", "노출 빈도",
];

/** 챗봇이 일반 질문에 답하는 문장. 목의 기본 답변 대신 가이드 화면에 어울리는 업무 이야기를 쓴다. */
export const HELP_DEMO_CHAT_ANSWERS = [
  "4월 캠페인 성과 리뷰에서는 ROAS 402%로 목표 380%를 넘겼다고 정리됐습니다. 채널 중에서는 디스플레이가 180%로 가장 낮아, 5월에는 예산을 600만 원에서 300만 원으로 줄이기로 했습니다.",
  "지금 남은 할 일은 김서윤님 몫으로 두 가지입니다. KPI 문서 업데이트(이번 주)와 주간 성과 한 장 리포트(다음 주 월요일부터)입니다. 둘 다 4월 캠페인 성과 리뷰에서 맡았습니다.",
  "신제품 소개 페이지 문구는 제목을 「가볍게 스며드는 수분 크림」으로 정했고, 부제의 숫자는 시험 성적서를 확인한 뒤에 넣기로 했습니다. 법무 검토는 최종 문구가 나온 뒤 요청합니다.",
  "고객 인터뷰에서는 구매 전에 낮은 별점 후기를 먼저 읽는다는 말이 가장 많이 반복됐습니다. 가격은 용량 대비 사용 기간을 알고 나면 괜찮다는 반응이 많았습니다.",
  "이번 주 운영 점검에서는 첫 응답 시간이 목표를 넘은 원인이 문의 분류 오류와 휴가 공백으로 좁혀졌습니다. 분류 규칙은 이번 주 안에 고치기로 했습니다.",
];

type Chats = Pick<StoreState, "agentChats" | "agentChatMessages">;

/** 개인 챗봇 대화 4개. 첫 대화는 회의 근거를 인용하는 4턴이고 마지막 질문은 몇 분 전이다. */
export function helpDemoChats(now: number): Chats {
  const minutesAgo = (minutes: number) => new Date(now - minutes * 60_000).toISOString();
  const campaign = NOTE_DEFS.find((def) => def.noteId === HD_NOTE_IDS.campaign)!;
  const scope = [{ kind: "NOTE" as const, id: campaign.noteId, title: campaign.title, unavailable: false }];
  const marker = `@[${campaign.title}](noteId:${campaign.noteId})`;

  const chats: Chats["agentChats"] = [];
  const messages: Chats["agentChatMessages"] = [];
  let turn = 0;

  const open = (chatId: string, title: string, createdAt: string) => {
    chats.push({ chatId, workspaceId: HD_WORKSPACE_ID, title, titleSource: "QUESTION", createdAt, updatedAt: createdAt });
    return chatId;
  };
  const exchange = (
    chatId: string,
    askedAt: string,
    ask: string,
    answer: string,
    options: { scoped?: boolean; tool?: string } = {}
  ) => {
    turn += 1;
    const turnId = `01KH0000060${String(turn).padStart(2, "0")}`;
    const at = (seconds: number) => new Date(Date.parse(askedAt) + seconds * 1000).toISOString();
    messages.push({
      chatId, turnId, createdAt: askedAt, role: "USER", content: ask,
      scope: options.scoped ? scope : [], toolEvent: null,
    });
    if (options.tool) {
      messages.push({
        chatId, turnId, createdAt: at(3), role: "THINKING",
        content: "회의 스크립트에서 관련 발화를 찾아 근거를 확인합니다.", scope: [], toolEvent: null,
      });
      messages.push({
        chatId, turnId, createdAt: at(5), role: "TOOL", content: options.tool, scope: [],
        toolEvent: { tool: "transcripts.search", decision: null, status: "success", url: null, card: null },
      });
    }
    messages.push({
      chatId, turnId, createdAt: at(9), role: "ASSISTANT", content: answer, scope: [], toolEvent: null,
    });
  };

  const followUp = open("01KH000005001", "4월 캠페인 후속 정리", minutesAgo(26 * 60));
  exchange(
    followUp, minutesAgo(26 * 60), `${marker} 에서 정한 것만 정리해줘`,
    "결정은 아홉 가지입니다. 핵심은 세 가지예요.\n\n1. 디스플레이는 5월에 600만 원에서 300만 원으로 줄입니다.\n2. 리타겟팅은 오늘부터 소재 B로 바꿉니다.\n3. 5월 ROAS 목표는 450%, 신규 고객 비중 목표는 45%입니다.\n\n근거: 이하린이 예산안을 정리한 대목(약 31분)과 박도윤이 리타겟팅 성과를 설명한 대목(약 22분)입니다.",
    { scoped: true, tool: "스크립트에서 관련 발화 검색 · 4건 찾음" }
  );
  exchange(
    followUp, minutesAgo(25 * 60), "내가 맡은 할 일은 뭐야?",
    "김서윤님 몫은 두 가지입니다. KPI 문서를 이번 주 안에 업데이트하는 일, 그리고 주간 성과 한 장 리포트를 다음 주 월요일부터 올리는 일입니다. 둘 다 회의 마지막에 정리한 할 일 목록에 있습니다.",
    { scoped: true }
  );
  exchange(
    followUp, minutesAgo(180), "5월 예산은 어떻게 나눴지?",
    "5월 총 예산 5,000만 원을 이렇게 나눴습니다.\n\n- 검색 2,000만 원\n- 소셜 2,100만 원\n- 이메일 400만 원\n- 디스플레이 300만 원\n- 리타겟팅 200만 원\n\n검색은 한계선이 2,000만 원이라는 박도윤의 설명(약 41분)이 근거였습니다.",
    { scoped: true }
  );
  exchange(
    followUp, minutesAgo(7), "디스플레이를 줄이는 이유가 뭐였지?",
    "ROAS가 180%로 목표 380%의 절반에도 못 미쳤고, 3월에도 200% 근처였기 때문입니다. 타깃을 좁혀 봤지만 크게 달라지지 않았다는 설명이 있었습니다(박도윤, 약 17분). 대신 지역 비교 테스트로 간접 효과를 확인해 보기로 했습니다.",
    { scoped: true }
  );

  const landing = open("01KH000005002", "신제품 문구 확정 사항", minutesAgo(3 * 24 * 60));
  exchange(landing, minutesAgo(3 * 24 * 60), "신제품 소개 페이지 문구에서 아직 못 정한 게 뭐야?", HELP_DEMO_CHAT_ANSWERS[2]);

  const weekly = open("01KH000005003", "운영 점검 요약", minutesAgo(8 * 24 * 60));
  exchange(weekly, minutesAgo(8 * 24 * 60), "지난주 운영 점검에서 나온 얘기 요약해줘", HELP_DEMO_CHAT_ANSWERS[4]);

  const interview = open("01KH000005004", "인터뷰에서 반복된 말", minutesAgo(5 * 24 * 60));
  exchange(interview, minutesAgo(5 * 24 * 60), "고객 인터뷰에서 반복된 얘기 있어?", HELP_DEMO_CHAT_ANSWERS[3]);

  // 목록 정렬 기준은 마지막 메시지 시각이다.
  for (const chat of chats) {
    const last = messages.filter((message) => message.chatId === chat.chatId).at(-1);
    if (last) chat.updatedAt = last.createdAt;
  }
  return { agentChats: chats, agentChatMessages: messages };
}

/** 문의 · 피드백 여섯 건. 답변 셋 중 하나는 아직 읽지 않았다. */
export function helpDemoFeedbacks(now: number): StoreState["feedbacks"] {
  const ago = (hours: number) => new Date(now - hours * 3_600_000).toISOString();
  return [
    {
      feedbackId: "01KH000007001", kind: "INCIDENT",
      message: "회의 녹음 중에 전사가 몇 분 멈춘 것처럼 보였어요. 데스크톱 앱이고 노트 화면이었습니다.",
      answer: "불편을 드려 죄송합니다. 네트워크가 잠깐 끊긴 구간이 있었고, 다시 연결되면서 이어서 받아쓰도록 고쳤습니다.",
      answeredAt: ago(3), answerSeen: false, createdAt: ago(20),
    },
    {
      feedbackId: "01KH000007002", kind: "SUGGESTION",
      message: "회의 요약을 참석자에게 메일로 자동 전송하는 옵션이 있으면 좋겠어요.",
      answer: null, answeredAt: null, answerSeen: false, createdAt: ago(30),
    },
    {
      feedbackId: "01KH000007003", kind: "QUESTION",
      message: "회의가 시작된 뒤에도 참석자를 추가할 수 있나요?",
      answer: "네, 노트 정보 탭의 참석자에서 언제든 추가할 수 있습니다. 이미 지나간 발화의 화자는 그대로 두고, 이후 지정부터 반영됩니다.",
      answeredAt: ago(24 * 5), answerSeen: true, createdAt: ago(24 * 6),
    },
    {
      feedbackId: "01KH000007004", kind: "OTHER",
      message: "사용 가이드에 화자 지정 방법이 더 자세히 있으면 좋겠어요.",
      answer: null, answeredAt: null, answerSeen: false, createdAt: ago(24 * 9),
    },
    {
      feedbackId: "01KH000007005", kind: "SUGGESTION",
      message: "할 일에 담당자를 두 명 이상 지정하고 싶어요.",
      answer: "의견 감사합니다. 지금은 한 명으로 지정하는 방식인데, 여러 명 지정은 검토 목록에 올려 두었습니다.",
      answeredAt: ago(24 * 12), answerSeen: true, createdAt: ago(24 * 13),
    },
    {
      feedbackId: "01KH000007006", kind: "INCIDENT",
      message: "초대 메일이 평소보다 늦게 도착했어요. 한 시간쯤 걸렸습니다.",
      answer: null, answeredAt: null, answerSeen: false, createdAt: ago(24 * 15),
    },
  ];
}

/** 연동: Linear 는 연결됨(관리자 본인), GitHub 는 연결 안 됨. 연습 공간은 둘 다 안 됨. */
export function helpDemoIntegrations(now: number): StoreState["integrations"] {
  return [
    { workspaceId: HD_WORKSPACE_ID, provider: "LINEAR", connected: true, connectedBy: "김서윤", connectedAt: new Date(now - 40 * 86_400_000).toISOString() },
    { workspaceId: HD_WORKSPACE_ID, provider: "GITHUB", connected: false, connectedBy: null, connectedAt: null },
    { workspaceId: HD_PRACTICE_WORKSPACE_ID, provider: "LINEAR", connected: false, connectedBy: null, connectedAt: null },
    { workspaceId: HD_PRACTICE_WORKSPACE_ID, provider: "GITHUB", connected: false, connectedBy: null, connectedAt: null },
  ];
}

/** 외부 에이전트(MCP) 연결: 쓰는 중 둘, 회수 하나, 다른 멤버 하나(관리자 목록용). */
export function helpDemoDelegations(now: number): Pick<StoreState, "agentDelegations" | "agentDelegationUsages"> {
  const day = 86_400_000;
  const iso = (offsetDays: number) => new Date(now + offsetDays * day).toISOString();
  const base = { workspaceId: HD_WORKSPACE_ID, workspaceName: "봄바람 스튜디오", userId: HD_ME };
  const agentDelegations: StoreState["agentDelegations"] = [
    {
      ...base, delegationId: "01KH000008001", name: "Claude", tokenHint: "hm_Kq3Vn8x", credentialKind: "PERSONAL_TOKEN",
      allowTaskChanges: true, status: "ACTIVE", createdAt: iso(-30), lastUsedAt: new Date(now - 2 * 3_600_000).toISOString(), expiresAt: iso(88), revokedAt: null, revokeReason: null,
    },
    {
      ...base, delegationId: "01KH000008002", name: "ChatGPT", tokenHint: null, credentialKind: "OAUTH",
      allowTaskChanges: false, status: "ACTIVE", createdAt: iso(-12), lastUsedAt: iso(-1), expiresAt: iso(79), revokedAt: null, revokeReason: null,
    },
    {
      ...base, delegationId: "01KH000008003", name: "Claude Code", tokenHint: "hm_Tz7Ld2m", credentialKind: "PERSONAL_TOKEN",
      allowTaskChanges: false, status: "REVOKED", createdAt: iso(-60), lastUsedAt: iso(-25), expiresAt: iso(30), revokedAt: iso(-20), revokeReason: "USER",
    },
    {
      ...base, userId: HD_MEMBERS.harin.userId, delegationId: "01KH000008004", name: "하린의 ChatGPT", tokenHint: null, credentialKind: "OAUTH",
      allowTaskChanges: false, status: "ACTIVE", createdAt: iso(-8), lastUsedAt: iso(-2), expiresAt: iso(82), revokedAt: null, revokeReason: null,
    },
  ];
  const tools = ["list_projects", "list_project_items", "get_project_item", "list_open_tasks", "open_screen", "get_meeting_transcript"];
  const usage = (delegationId: string, count: number, startHoursAgo: number) =>
    Array.from({ length: count }, (_, index) => {
      const toolName = tools[index % tools.length];
      const failed = index % 9 === 4;
      return {
        delegationId,
        usageId: `${delegationId.slice(0, 11)}U${String(index).padStart(2, "0")}`,
        toolName,
        outcome: failed ? ("FAILED" as const) : ("SUCCEEDED" as const),
        resultCount: failed || toolName === "open_screen" ? null : (index % 5) + 1,
        occurredAt: new Date(now - (startHoursAgo + index * 0.5) * 3_600_000).toISOString(),
      };
    });
  return {
    agentDelegations,
    agentDelegationUsages: [
      ...usage("01KH000008001", 14, 2),
      ...usage("01KH000008002", 6, 26),
    ],
  };
}
