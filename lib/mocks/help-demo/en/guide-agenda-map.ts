import type { NoteResponseData, ProjectMeetingLinksResponseData } from "@/lib/api/generated/models";
import type { MeetingReviewSummary } from "@/lib/notes/review/summary";

/**
 * 가이드 촬영 전용 「연결 지도」 데이터(APP-1455). 가이드 목 프리셋(`lib/mocks/help-demo`)이 켜졌을 때만 쓰인다 —
 * 프리셋 상태에 프로젝트·노트를 더하는 것은 `help-demo/build.ts`, 지도와 요약 응답을 돌려주는 것은 `project-agenda-map.ts` 가
 * `isHelpDemoEnabled()` 로 가른다. 꺼져 있으면 이 파일은 읽히지 않는다. 사람 이름·실제 팀 데이터는 하나도 없는 가상의 앱 출시 준비 프로젝트다.
 *
 * 모양: 회의 7개(9/17~10/27, 주 단위) · 안건 42개 · 주제 6개(요금제·온보딩·베타·릴리스·알림·문의). 같은 회의 안 이어짐(캡슐 2곳),
 * 갈라짐 2곳(요금제의 환불·학생 할인 — 둘이 구간이 겹쳐 하나는 「+2」로 접힌다), 이어짐 없는 안건, 완료·미완료가 섞여 있다.
 * 촬영 방법은 `scripts/help-media/README.md`.
 */
export const GUIDE_AGENDA_PROJECT_ID = "0PGP000000001";
export const GUIDE_AGENDA_PROJECT_NAME = "App Launch Prep";

// [날짜(2026), 제목] — 한국 시간 오전 10시
const MEETINGS = [
  ["09-17", "Product launch kickoff"],
  ["09-24", "Weekly sync"],
  ["10-01", "Customer interview debrief"],
  ["10-08", "Design review"],
  ["10-15", "Weekly sync"],
  ["10-22", "Beta midpoint check"],
  ["10-27", "Launch readiness review"],
] as const;

type Row = readonly [
  key: string,
  meeting: number,
  title: string,
  completed: boolean,
  parent: string | null,
  summary: string,
  decisions: number,
  actions: number,
  conclusion: string | null,
  open: string | null,
];

// 안건. 같은 회의 안에서는 적힌 순서가 다룬 순서다. parent 는 이어받은 앞 안건
const ROWS: readonly Row[] = [

  ["p1",1,"Pricing plan structure",true,null,"We'll start with monthly and annual plans. What the free plan includes will be decided next meeting after looking at a comparison.",1,1,"Launch with monthly and annual plans.",null],
  ["o1",1,"Onboarding flow draft",false,null,"We mapped the steps from sign-up to creating a first meeting and agreed there are too many.",0,1,null,"Need to find out how many steps we can cut."],
  ["b1",1,"Beta tester recruiting plan",false,null,"We set a goal of 30 beta testers and outlined when and whom to recruit.",1,1,null,null],
  ["r1",1,"Pre-launch checklist scope",false,null,"We split the pre-launch checks into three groups: payments, notifications, and terms.",1,0,null,null],
  ["x1",1,"Team roles",true,null,"We assigned an owner for each area of launch prep.",1,2,null,null],
  ["p2",2,"Competitor pricing comparison",true,"p1","We compared pricing and free tiers for four similar apps in a table. Most of them offer a free trial.",0,1,"Explore offering a free trial.",null],
  ["o2",2,"Cutting onboarding steps",false,"o1","We discussed cutting the path from sign-up to first meeting from five steps to three.",1,1,null,"Need to check whether we can drop the email verification step."],
  ["b2",2,"Choosing beta recruiting channels",false,"b1","We'll recruit through the newsletter and the community, and someone took on drafting the announcement.",1,2,null,null],
  ["r2",2,"Checklist owners",true,"r1","We named an owner for each group and set review dates.",1,1,null,null],
  ["x2",2,"Weekly metrics update",true,null,"We shared sign-ups and the first-meeting creation rate.",0,0,null,null],
  ["p3",3,"Free trial length",false,"p2","We went over interview feedback on whether the trial should be 7 or 14 days.",0,1,null,"Some felt 14 days was too long, so we'll check again."],
  ["s1",3,"Handling support requests",false,null,"To get ahead of more requests, we set who answers them and a target response time.",1,1,null,null],
  ["o3",3,"Where onboarding drops off",false,"o2","Interviewees kept saying they got stuck at the second step.",0,2,null,"Need to figure out whether the copy or the step itself is the problem."],
  ["b3",3,"Recruiting more interviewees",true,"b2","We'll bring in five more customers to interview and scheduled the sessions.",1,1,null,null],
  ["p4",3,"Refund policy",false,"p2","We discussed the refund window for subscriptions and agreed to write a draft only.",0,1,null,"Needs legal review."],
  ["q1",4,"Student discount",false,"p3","We gathered views on giving college students a first-month discount after the trial.",0,1,null,"Need to decide how big the discount should be."],
  ["p5",4,"Trial set to 14 days",true,"p3","The trial will be 14 days, with a reminder sent 3 days before it ends.",2,1,"The free trial is 14 days.",null],
  ["o4",4,"Onboarding screen mockups",true,"o3","We reviewed new mockups that merge the second step and tightened the copy.",1,2,"Go with mockup B.",null],
  ["b4",4,"Recruiting copy review",true,"b3","We'll cut the questions on the sign-up form that feel too long.",1,1,null,null],
  ["r3",4,"Checklist review, round 1",false,"r2","Payments is done, and two items are left in notifications.",0,2,null,"Terms hasn't been started yet."],
  ["n1",4,"Notification settings screen",false,null,"We reviewed the layout for a screen that turns each notification type on or off.",1,1,null,null],
  ["p6",5,"Pricing page copy",false,"p5","We read through and edited the draft plan comparison table and trial copy.",1,1,null,null],
  ["p7",5,"Refund rule finalized",true,"p4","We confirmed refunds within 7 days of subscribing.",1,1,"Refunds are available within 7 days of payment.",null],
  ["o5",5,"Onboarding usability test",false,"o4","Five people tried the new mockups, and four got through without getting stuck.",0,2,null,"We'll look into what tripped up the fifth person."],
  ["b5",5,"Screening beta applicants",false,"b4","Out of 80 applicants, we shortlisted 40 with a clear use case.",1,1,null,null],
  ["b6",5,"Beta schedule set",true,"b5","The beta runs for two weeks, and the first welcome email goes out this week.",2,1,"The beta runs for two weeks.",null],
  ["s2",5,"Support reply guide",true,"s1","We gathered reply copy for the ten most common questions.",0,1,null,null],
  ["r4",5,"Checklist review, round 2",false,"r3","Notifications is done, and we've started reviewing terms.",0,1,null,null],
  ["q2",6,"Student verification",false,"q1","We leaned toward keeping it simple and verifying students by school email.",1,1,null,null],
  ["p8",6,"Pricing page QA",true,"p6","We checked line by line that the prices and trial details match what we decided.",0,1,null,null],
  ["o6",6,"Applying onboarding fixes",false,"o5","We'll apply the three copy fixes that came out of testing.",1,2,null,null],
  ["b7",6,"Beta feedback, round 1",false,"b6","We sorted twelve pieces of feedback from the first week. The top complaint was too many notifications.",0,2,null,"Need to sort the feedback by priority."],
  ["r5",6,"Checklist review, round 3",false,"r4","Only terms is left. Everything else has been checked.",0,1,null,null],
  ["n2",6,"Notification copy review",true,"n1","We shortened the notification copy and made the tone consistent.",1,1,null,null],
  ["x3",6,"App store review prep",false,null,"We listed the descriptions and screenshots needed for review.",0,2,null,null],
  ["p9",7,"Final launch pricing check",true,"p8","We reviewed the launch day price list and agreed nothing changes.",1,0,"Launch with the price list as is.",null],
  ["o7",7,"Onboarding completion rate",false,"o6","We checked whether the first-meeting creation rate went up noticeably after the fixes.",0,1,null,"Keep watching it for two weeks after launch."],
  ["b8",7,"Beta feedback fix list",false,"b7","We split the feedback into five fixes before launch and the rest for after.",2,2,null,null],
  ["r6",7,"Final launch date check",false,"r5","Once the remaining terms item is done, we can launch on schedule.",1,2,null,"If the terms review runs late, we'll revisit the date."],
  ["r7",7,"Launch announcement draft",false,"r6","We outlined what goes in the launch announcement and picked who drafts it.",0,1,null,null],
  ["n3",7,"Notification send time",false,"n2","We'll send notifications around 10 a.m.",1,1,null,null],
  ["s3",7,"Support inbox check",true,"s2","We reviewed where support requests land after launch and how often we check them.",0,1,null,null],];

const noteId = (meeting: number) => `0PGN${String(meeting).padStart(9, "0")}`;
const agendaId = (key: string) => `0PGA${String(ROWS.findIndex((row) => row[0] === key) + 1).padStart(9, "0")}`;
const startedAt = (meeting: number) => `2026-${MEETINGS[meeting - 1][0]}T01:00:00.000Z`;

/** `GET /v1/projects/{projectId}/meeting-links`(noteId 없음)의 data. 서버처럼 최근 회의가 먼저다 */
export function guideAgendaMapLinks(): ProjectMeetingLinksResponseData {
  return {
    notes: MEETINGS.map(([, title], index) => ({
      noteId: noteId(index + 1),
      title,
      startedAt: startedAt(index + 1),
      agendas: ROWS.filter((row) => row[1] === index + 1).map((row) => ({
        agendaId: agendaId(row[0]),
        title: row[2],
        completed: row[3],
        proposalIds: [],
      })),
    })).reverse(),
    agendaLinks: ROWS.flatMap((row) => {
      const parent = row[4] && ROWS.find((candidate) => candidate[0] === row[4]);
      return parent
        ? [{ source: { noteId: noteId(row[1]), agendaId: agendaId(row[0]) }, target: { noteId: noteId(parent[1]), agendaId: agendaId(parent[0]) } }]
        : [];
    }),
    meetingLinks: [],
    conflicts: [],
  };
}

/** 프리셋 상태에 더할 프로젝트와 회의. 참석자 등은 프리셋의 첫 노트에서 빌린다 */
export function guideAgendaMapSeed(workspaceId: string, template: NoteResponseData) {
  const project = {
    projectId: GUIDE_AGENDA_PROJECT_ID,
    workspaceId,
    name: GUIDE_AGENDA_PROJECT_NAME,
    description: "Getting the new app ready for launch.",
    createdAt: startedAt(1),
    updatedAt: startedAt(MEETINGS.length),
  };
  const notes: NoteResponseData[] = MEETINGS.map(([, title], index) => {
    const start = Date.parse(startedAt(index + 1));
    return {
      ...structuredClone(template),
      noteId: noteId(index + 1),
      workspaceId,
      projectId: GUIDE_AGENDA_PROJECT_ID,
      projectName: GUIDE_AGENDA_PROJECT_NAME,
      title,
      createdAt: startedAt(index + 1),
      updatedAt: startedAt(index + 1),
      meetingStatus: "ENDED",
      meetingStartedAt: startedAt(index + 1),
      meetingEndedAt: new Date(start + 40 * 60_000).toISOString(),
      recordedDurationMs: 40 * 60_000,
      activeSessionStartedAt: null,
      pausedAt: null,
      contextTopic: null,
      contextBackground: null,
      autoEnd: null,
    };
  });
  return { project, notes };
}

/** 이 가이드 회의의 요약(안건 한 줄 요약 · 결정·할 일 수 · 결론 · 남은 질문). 이 회의가 아니면 null */
export function guideAgendaMapSummary(id: string): MeetingReviewSummary | null {
  const meeting = Array.from({ length: MEETINGS.length }, (_, index) => index + 1).find((n) => noteId(n) === id);
  if (!meeting) return null;
  return {
    noteId: id,
    status: "SUCCEEDED",
    resultVersion: "1",
    headline: null,
    lead: [],
    topics: [],
    agendas: ROWS.filter((row) => row[1] === meeting).map((row, at) => ({
      agendaId: agendaId(row[0]),
      title: row[2],
      ordinal: at + 1,
      completed: row[3],
      summary: row[5],
      description: [],
      conclusions: row[8] ? [{ itemIds: [], text: row[8] }] : [],
      openItems: row[9] ? [{ itemIds: [], text: row[9] }] : [],
      sentences: [],
      members: [
        ...Array.from({ length: row[6] }, (_, n) => ({ itemId: `${agendaId(row[0])}-d${n}`, kind: "DECISION" as const })),
        ...Array.from({ length: row[7] }, (_, n) => ({ itemId: `${agendaId(row[0])}-t${n}`, kind: "ACTION_ITEM" as const })),
      ],
      memberships: [],
      relations: [],
      alsoItemIds: [],
      openItemIds: [],
      agendaItemId: null,
      centerItemId: null,
    })),
  };
}
