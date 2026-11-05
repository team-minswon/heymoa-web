import type { StoreState } from "@/lib/mocks/db";
import { HD_NOTE_IDS, NOTE_DEFS } from "@/lib/mocks/help-demo/en/notes";
import { HD_ME, HD_MEMBERS, HD_PRACTICE_WORKSPACE_ID, HD_WORKSPACE_ID } from "@/lib/mocks/help-demo/en/people";

/** 용어 사전. 쉼표 일괄 등록 시연용 「코호트, 리텐션, 이탈률」은 일부러 넣지 않는다. */
export const HELP_DEMO_TERMS = [
  "ROAS", "CTR", "CPC", "CPA", "conversion rate", "retargeting", "funnel", "OKR", "KPI", "A/B test",
  "landing page", "brand guide", "CRM", "lead", "onboarding", "Brightside", "key visual", "lookalike audience",
  "UGC", "attribution", "cart abandonment", "waitlist", "product detail page", "ad creative", "last-click", "frequency cap",
];

/** 챗봇이 일반 질문에 답하는 문장. 목의 기본 답변 대신 가이드 화면에 어울리는 업무 이야기를 쓴다. */
export const HELP_DEMO_CHAT_ANSWERS = [
  "The April campaign performance review recorded a ROAS of 402%, beating the 380% target. Display was the weakest channel at 180%, so its May budget goes from $6,000 down to $3,000.",
  "You have two open tasks: update the KPI doc (this week) and send a one-page weekly performance report (starting next Monday). Both came out of the April campaign performance review.",
  "For the new product landing page, the headline is set to \"A lightweight moisturizer that sinks right in.\" The number in the subheadline waits until the lab report is confirmed. Legal review will be requested once the final copy is ready.",
  "The most repeated point in the customer interviews was that people read the low-star reviews first before buying. On price, most were fine with it once they knew how long one jar lasts.",
  "This week's ops check-in narrowed the slow first response time down to two causes: misrouted tickets and gaps from people being out on vacation. The routing rules will be fixed this week.",
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
        content: "Searching the meeting transcript for relevant lines to back up the answer.", scope: [], toolEvent: null,
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

  const followUp = open("01KH000005001", "April campaign follow-ups", minutesAgo(26 * 60));
  exchange(
    followUp, minutesAgo(26 * 60), `Just list what was decided in ${marker}`,
    "There were nine decisions. These three matter most:\n\n1. Display drops from $6,000 to $3,000 in May.\n2. Retargeting switches to creative B starting today.\n3. The May ROAS target is 450%, and the new-customer share target is 45%.\n\nSources: Olivia Brooks walking through the budget plan (around 31 min) and Daniel Reyes explaining retargeting results (around 22 min).",
    { scoped: true, tool: "Searched the transcript for relevant lines · 4 found" }
  );
  exchange(
    followUp, minutesAgo(25 * 60), "What tasks are mine?",
    "You have two: update the KPI doc by the end of this week, and post a one-page weekly performance report starting next Monday. Both are on the task list wrapped up at the end of the meeting.",
    { scoped: true }
  );
  exchange(
    followUp, minutesAgo(180), "How did we split the May budget?",
    "The $50,000 May budget was split like this:\n\n- Search $20,000\n- Social $21,000\n- Email $4,000\n- Display $3,000\n- Retargeting $2,000\n\nThe search cap came from Daniel Reyes pointing out that returns flatten past $20,000 (around 41 min).",
    { scoped: true }
  );
  exchange(
    followUp, minutesAgo(7), "Why are we cutting display again?",
    "Its ROAS was 180%, less than half the 380% target, and it was around 200% in March too. Daniel Reyes mentioned that narrowing the targeting didn't change much (around 17 min). Instead, the team will run a regional comparison test to check for indirect effects.",
    { scoped: true }
  );

  const landing = open("01KH000005002", "New product copy decisions", minutesAgo(3 * 24 * 60));
  exchange(landing, minutesAgo(3 * 24 * 60), "What's still undecided in the landing page copy?", HELP_DEMO_CHAT_ANSWERS[2]);

  const weekly = open("01KH000005003", "Ops check-in summary", minutesAgo(8 * 24 * 60));
  exchange(weekly, minutesAgo(8 * 24 * 60), "Summarize last week's ops check-in", HELP_DEMO_CHAT_ANSWERS[4]);

  const interview = open("01KH000005004", "Recurring interview themes", minutesAgo(5 * 24 * 60));
  exchange(interview, minutesAgo(5 * 24 * 60), "Did anything come up again and again in the customer interviews?", HELP_DEMO_CHAT_ANSWERS[3]);

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
      message: "While I was recording a meeting, the transcript seemed to freeze for a few minutes. This was in the desktop app, on the meeting notes screen.",
      answer: "Sorry for the trouble. Your connection dropped briefly, and we've fixed it so transcription picks up where it left off once you reconnect.",
      answeredAt: ago(3), answerSeen: false, createdAt: ago(20),
    },
    {
      feedbackId: "01KH000007002", kind: "SUGGESTION",
      message: "It would be great to have an option that automatically emails the meeting summary to attendees.",
      answer: null, answeredAt: null, answerSeen: false, createdAt: ago(30),
    },
    {
      feedbackId: "01KH000007003", kind: "QUESTION",
      message: "Can I add attendees after a meeting has already started?",
      answer: "Yes, you can add them anytime under Attendees in the note's Info tab. Speakers on earlier lines stay as they are, and the change applies to assignments from then on.",
      answeredAt: ago(24 * 5), answerSeen: true, createdAt: ago(24 * 6),
    },
    {
      feedbackId: "01KH000007004", kind: "OTHER",
      message: "Could the user guide explain how to assign speakers in more detail?",
      answer: null, answeredAt: null, answerSeen: false, createdAt: ago(24 * 9),
    },
    {
      feedbackId: "01KH000007005", kind: "SUGGESTION",
      message: "I'd like to assign more than one person to a task.",
      answer: "Thanks for the suggestion. Tasks take one assignee for now, but we've added multiple assignees to our list to look into.",
      answeredAt: ago(24 * 12), answerSeen: true, createdAt: ago(24 * 13),
    },
    {
      feedbackId: "01KH000007006", kind: "INCIDENT",
      message: "An invite email arrived much later than usual. It took about an hour.",
      answer: null, answeredAt: null, answerSeen: false, createdAt: ago(24 * 15),
    },
  ];
}

/** 연동: Linear 는 연결됨(관리자 본인), GitHub 는 연결 안 됨. 연습 공간은 둘 다 안 됨. */
export function helpDemoIntegrations(now: number): StoreState["integrations"] {
  return [
    { workspaceId: HD_WORKSPACE_ID, provider: "LINEAR", connected: true, connectedBy: "Emma Carter", connectedAt: new Date(now - 40 * 86_400_000).toISOString() },
    { workspaceId: HD_WORKSPACE_ID, provider: "GITHUB", connected: false, connectedBy: null, connectedAt: null },
    { workspaceId: HD_PRACTICE_WORKSPACE_ID, provider: "LINEAR", connected: false, connectedBy: null, connectedAt: null },
    { workspaceId: HD_PRACTICE_WORKSPACE_ID, provider: "GITHUB", connected: false, connectedBy: null, connectedAt: null },
  ];
}

/** 외부 에이전트(MCP) 연결: 쓰는 중 둘, 회수 하나, 다른 멤버 하나(관리자 목록용). */
export function helpDemoDelegations(now: number): Pick<StoreState, "agentDelegations" | "agentDelegationUsages"> {
  const day = 86_400_000;
  const iso = (offsetDays: number) => new Date(now + offsetDays * day).toISOString();
  const base = { workspaceId: HD_WORKSPACE_ID, workspaceName: "Brightside Studio", userId: HD_ME };
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
      ...base, userId: HD_MEMBERS.harin.userId, delegationId: "01KH000008004", name: "Olivia's ChatGPT", tokenHint: null, credentialKind: "OAUTH",
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
