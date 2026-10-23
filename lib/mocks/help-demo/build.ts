import type {
  NoteResponseData,
  TranscriptResponseDataDiarization,
} from "@/lib/api/generated/models";
import type { StoreState } from "@/lib/mocks/db";
import {
  helpDemoChats,
  helpDemoDelegations,
  helpDemoFeedbacks,
  helpDemoIntegrations,
} from "@/lib/mocks/help-demo/misc";
import { MID_MEETINGS } from "@/lib/mocks/help-demo/mid";
import { HD_NOTE_IDS, NOTE_DEFS, type NoteDef } from "@/lib/mocks/help-demo/notes";
import {
  HD_GUESTS,
  HD_ME,
  HD_ME_EMAIL,
  HD_ME_NAME,
  HD_MEMBERS,
  HD_PRACTICE_WORKSPACE_ID,
  HD_PROJECTS,
  HD_WORKSPACE_ID,
  personName,
  type GuestKey,
  type MemberKey,
  type PersonRef,
} from "@/lib/mocks/help-demo/people";
import type { ParsedScript } from "@/lib/mocks/help-demo/script";
import { CAMPAIGN_SCRIPT } from "@/lib/mocks/help-demo/script-campaign";
import { LANDING_SCRIPT } from "@/lib/mocks/help-demo/script-landing";
import { WEEKLY_SCRIPT } from "@/lib/mocks/help-demo/script-weekly";
import { SMALL_SCRIPTS } from "@/lib/mocks/help-demo/small";
import { DAY_MS, atHour } from "@/lib/mocks/help-demo/time";
import { MOCK_ACCOUNT, MOCK_USER } from "@/lib/mocks/mock-user";

type Segment = StoreState["segments"][number];
type Session = StoreState["sessions"][number];

/** 일시정지된 회의(FAQ 초안 리뷰)에 남은 앞부분 전사. */
const PAUSED_SCRIPT: ParsedScript = {
  lines: [
    { label: "A", text: "FAQ 초안 스무 개 중에 열두 개를 먼저 같이 볼게요." },
    { label: "B", text: "네, 출시일과 가격 질문은 아직 확정이 안 돼서 비워 두었어요." },
    { label: "A", text: "그 두 개는 빼고 나머지부터 문구를 다듬죠." },
  ],
  anchors: {},
};

function scriptOf(def: NoteDef): ParsedScript | null {
  if (def.status === "PAUSED") return PAUSED_SCRIPT;
  const source = def.source;
  if (!source) return null;
  if (source.kind === "small") return SMALL_SCRIPTS[source.id];
  if (source.kind === "mid") return MID_MEETINGS[source.id].script;
  return { campaign: CAMPAIGN_SCRIPT, landing: LANDING_SCRIPT, weekly: WEEKLY_SCRIPT }[source.id];
}

/** 발화 길이로 말하는 데 걸린 시간을 정한다. 무작위 없이 인덱스로 사이 간격을 벌린다. */
function timed(script: ParsedScript) {
  let at = 1_200;
  return script.lines.map((line, index) => {
    const duration = Math.min(28_000, 700 + line.text.length * 175);
    const row = { ...line, startedAtMs: at, endedAtMs: at + duration };
    at += duration + 350 + ((index * 211) % 1_100);
    return row;
  });
}

const memberOf = (key: MemberKey) => HD_MEMBERS[key];
const guestOf = (key: GuestKey) => HD_GUESTS[key];

export function createHelpDemoState(now = Date.now()): StoreState {
  const iso = (ms: number) => new Date(ms).toISOString();
  const user = { ...MOCK_USER, name: HD_ME_NAME, email: HD_ME_EMAIL };

  const workspaces: StoreState["workspaces"] = [
    {
      workspaceId: HD_WORKSPACE_ID,
      name: "봄바람 스튜디오",
      description: "캠페인, 신제품 출시, 고객 인터뷰를 함께 챙기는 마케팅 팀의 공간입니다.",
      role: "ADMIN",
      agentAccessAllowed: true,
    },
    // 프로젝트도 노트도 없는 새 워크스페이스. 온보딩 화면을 찍을 때 쓴다.
    { workspaceId: HD_PRACTICE_WORKSPACE_ID, name: "연습 공간", description: null, role: "ADMIN", agentAccessAllowed: true },
  ];

  const projects: StoreState["projects"] = Object.values(HD_PROJECTS).map((project, index) => ({
    projectId: project.id,
    workspaceId: HD_WORKSPACE_ID,
    name: project.name,
    description: project.description,
    createdAt: iso(now - (200 - index * 20) * DAY_MS),
    updatedAt: iso(now - (200 - index * 20) * DAY_MS),
  }));

  const members: StoreState["members"] = [
    ...(Object.keys(HD_MEMBERS) as MemberKey[]).map((key) => {
      const member = memberOf(key);
      return {
        workspaceId: HD_WORKSPACE_ID,
        userId: member.userId,
        name: member.accountName,
        displayName: member.displayName,
        email: member.email,
        role: member.role,
        image: member.userId === HD_ME ? user.image : null,
        joinedAt: iso(now - member.joinedDaysAgo * DAY_MS),
      };
    }),
    {
      workspaceId: HD_PRACTICE_WORKSPACE_ID,
      userId: HD_ME,
      name: HD_ME_NAME,
      displayName: null,
      email: HD_ME_EMAIL,
      role: "ADMIN",
      image: user.image,
      joinedAt: iso(now - 2 * DAY_MS),
    },
  ];

  const workspaceGuests: StoreState["workspaceGuests"] = (Object.keys(HD_GUESTS) as GuestKey[]).map((key, index) => ({
    guestId: guestOf(key).guestId,
    workspaceId: HD_WORKSPACE_ID,
    displayName: guestOf(key).displayName,
    createdAt: iso(now - (60 - index * 10) * DAY_MS),
  }));

  // ── 회의 ──
  let participantSeq = 0;
  const participantOf = (ref: PersonRef): NoteResponseData["participants"][number] => {
    participantSeq += 1;
    const participantId = `01KH4${String(participantSeq).padStart(8, "0")}`;
    if (ref.startsWith("g:")) {
      const guest = guestOf(ref.slice(2) as GuestKey);
      return { participantId, userId: null, guestId: guest.guestId, name: guest.displayName, email: null, image: null };
    }
    const member = memberOf(ref as MemberKey);
    return {
      participantId, userId: member.userId, guestId: null, name: personName(ref),
      email: member.email, image: member.userId === HD_ME ? user.image : null,
    };
  };

  const notes: NoteResponseData[] = [];
  const sessions: Session[] = [];
  const segments: Segment[] = [];
  const diarizations = new Map<string, TranscriptResponseDataDiarization>();
  let segmentSeq = 0;

  NOTE_DEFS.forEach((def, index) => {
    const project = HD_PROJECTS[def.project];
    const pairs = def.people.map((ref) => [ref, participantOf(ref)] as const);
    const participantByRef = new Map(pairs);
    const participants = pairs
      .map(([, participant]) => participant)
      .sort((a, b) => a.name.localeCompare(b.name) || a.participantId.localeCompare(b.participantId));

    const script = scriptOf(def);
    const lines = script ? timed(script) : [];
    const lastEnd = lines.at(-1)?.endedAtMs ?? 0;
    const sessionLength = lastEnd + 15_000;

    // 시작 시각. 오늘 열린 회의는 지금보다 앞서지 않게 끝나는 시각을 맞춘다.
    let startMs = atHour(def.daysAgo, def.hour, index % 7);
    if (def.status === "IN_PROGRESS") startMs = now - 30 * 60_000;
    else if (def.status === "ENDED" || def.status === "PAUSED") {
      const endMs = startMs + sessionLength;
      if (endMs > now - 5 * 60_000) startMs = now - 5 * 60_000 - sessionLength - index * 60_000;
    }
    const endMs = startMs + sessionLength;

    const starter = def.starter
      ? (() => {
          const member = memberOf(def.starter as MemberKey);
          return { userId: member.userId, name: personName(def.starter), email: member.email, image: member.userId === HD_ME ? user.image : null };
        })()
      : null;

    const started = def.status !== "NOT_STARTED";
    const createdMs = started ? startMs - 40 * 60_000 : Math.min(atHour(def.daysAgo, 8, index), now - (index + 2) * 60_000);
    notes.push({
      noteId: def.noteId,
      workspaceId: HD_WORKSPACE_ID,
      projectId: project.id,
      projectName: project.name,
      title: def.title,
      createdAt: iso(createdMs),
      updatedAt: iso(def.status === "ENDED" ? endMs : started ? startMs : createdMs),
      meetingStatus: def.status,
      meetingStartedAt: started ? iso(startMs) : null,
      meetingEndedAt: def.status === "ENDED" ? iso(endMs) : null,
      recordedDurationMs: 0,
      activeSessionStartedAt: null,
      meetingStartedBy: starter,
      participants,
      contextTopic: def.context?.topic ?? null,
      contextBackground: def.context?.background ?? null,
      autoEnd: null,
      pausedAt: null,
    });

    if (!script) return;
    const sessionId = `01KH0000020${String(index).padStart(2, "0")}`;
    sessions.push({
      sessionId,
      noteId: def.noteId,
      status: "COMPLETED",
      firstRecording: false,
      readyExpiresAt: iso(startMs + 600_000),
      startedAt: iso(startMs),
      endedAt: iso(startMs + (def.status === "IN_PROGRESS" ? lastEnd + 15_000 : sessionLength)),
      endReason: "CLIENT_DISCONNECTED",
    });
    // 진행 중 회의는 화자 분리 전이라 라벨이 없다(`null`). 끝난 회의는 라벨을 심는다.
    const labeled = def.status !== "IN_PROGRESS";
    const rows = lines.map((line, at): Segment => {
      segmentSeq += 1;
      return {
        segmentId: `01KH3${String(segmentSeq).padStart(8, "0")}`,
        transcriptionSessionId: sessionId,
        sequence: at + 1,
        text: line.text,
        startedAtMs: line.startedAtMs,
        endedAtMs: line.endedAtMs,
        speakerLabel: labeled ? line.label : null,
        assignedParticipantId: null,
      };
    });
    segments.push(...rows);

    if (!labeled || !def.speakers) return;
    const speakers = def.speakers.flatMap((ref, at) => {
      const label = "ABCDEF"[at];
      const own = rows.filter((row) => row.speakerLabel === label);
      if (own.length === 0) return [];
      const participant = ref ? participantByRef.get(ref) : undefined;
      const representative = own.find((row) => row.text.length >= 24) ?? own[0];
      return [
        {
          label,
          speakingMs: own.reduce((sum, row) => sum + (row.endedAtMs - row.startedAtMs), 0),
          segmentCount: own.length,
          representativeSegmentId: representative.segmentId,
          assignedParticipantId: participant?.participantId ?? null,
          assignedName: participant?.name ?? null,
          confirmed: participant !== undefined,
        },
      ];
    });
    diarizations.set(def.noteId, { status: "MAPPED", speakers });
  });

  // ── 초대와 알림 ──
  const invitations: StoreState["invitations"] = [
    {
      workspaceId: "01K0000000030",
      invitationId: "01KH000009001",
      inviteeName: HD_ME_NAME,
      inviteeEmail: HD_ME_EMAIL,
      inviteeImage: user.image,
      inviterName: personName("harin"),
      role: "MEMBER",
      status: "PENDING",
      createdAt: iso(now - 3_600_000),
      expiresAt: iso(now + 6 * DAY_MS),
    },
    // 우리 워크스페이스에서 합류를 기다리는 초대. 가입 전이라 이름이 없다.
    {
      workspaceId: HD_WORKSPACE_ID,
      invitationId: "01KH000009002",
      inviteeName: null,
      inviteeEmail: "new.member@example.com",
      inviteeImage: null,
      inviterName: HD_ME_NAME,
      role: "MEMBER",
      status: "PENDING",
      createdAt: iso(now - 2 * DAY_MS),
      expiresAt: iso(now + 5 * DAY_MS),
    },
  ];
  const notificationPayload = {
    workspaceId: HD_WORKSPACE_ID,
    workspaceName: "봄바람 스튜디오",
    invitationId: null,
    inviterUserId: null,
    noteId: null,
    noteTitle: null,
    autoEnded: false,
    pausedBusinessDays: null,
    feedbackId: null,
  };
  const notifications: StoreState["notifications"] = [
    {
      notificationId: "01KH000009101",
      type: "WORKSPACE_INVITATION",
      readAt: null,
      createdAt: invitations[0].createdAt,
      invitation: {
        invitationId: invitations[0].invitationId,
        status: "PENDING",
        role: "MEMBER",
        workspaceId: invitations[0].workspaceId,
        workspaceName: "디자인 팀",
        inviterName: invitations[0].inviterName,
        expiresAt: invitations[0].expiresAt,
      },
      payload: null,
    },
    // 가이드의 알림 클립(APP-1411)이 세 종류를 다 보이게 — 검토할 결과 준비 · 문의 답변
    {
      notificationId: "01KH000009102",
      type: "ANALYSIS_READY",
      readAt: null,
      createdAt: iso(now - 2 * 60 * 60 * 1000),
      invitation: null,
      payload: {
        ...notificationPayload,
        noteId: HD_NOTE_IDS.campaign,
        noteTitle: "4월 캠페인 성과 리뷰",
      },
    },
    {
      notificationId: "01KH000009103",
      type: "INQUIRY_ANSWERED",
      readAt: iso(now - 60 * 60 * 1000),
      createdAt: iso(now - 3 * 60 * 60 * 1000),
      invitation: null,
      payload: {
        ...notificationPayload,
        workspaceId: null,
        workspaceName: null,
        feedbackId: "01KH000007001",
      },
    },
  ];

  const chats = helpDemoChats(now);

  return {
    user: { ...user, ...MOCK_ACCOUNT },
    workspaces,
    projects,
    notes,
    sessions,
    segments,
    diarizations,
    extraGaps: new Map(),
    transcriptGaps: new Map(),
    members,
    workspaceGuests,
    invitations,
    notifications,
    feedbacks: helpDemoFeedbacks(now),
    analyses: [],
    integrations: helpDemoIntegrations(now),
    agentChats: chats.agentChats,
    agentChatMessages: chats.agentChatMessages,
    ...helpDemoDelegations(now),
    // 동의 화면(`/oauth/consent?state=mock-consent`)을 찍을 수 있게 하나 둔다.
    agentOAuthConsents: {
      "mock-consent": { clientName: "Claude", redirectUri: "http://127.0.0.1:1455/callback" },
    },
  };
}
