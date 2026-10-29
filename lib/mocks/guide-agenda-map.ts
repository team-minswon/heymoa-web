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
export const GUIDE_AGENDA_PROJECT_NAME = "앱 출시 준비";

// [날짜(2026), 제목] — 한국 시간 오전 10시
const MEETINGS = [
  ["09-17", "제품 출시 킥오프"],
  ["09-24", "주간 회의"],
  ["10-01", "고객 인터뷰 정리"],
  ["10-08", "디자인 리뷰"],
  ["10-15", "주간 회의"],
  ["10-22", "베타 중간 점검"],
  ["10-27", "출시 점검 회의"],
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

  ["p1",1,"요금제 구성",true,null,"월 구독과 연 구독 두 가지로 시작하기로 하고, 무료 플랜의 범위는 다음 회의에서 비교 자료를 보고 정하기로 했어요.",1,1,"월 구독과 연 구독 두 가지로 시작합니다.",null],
  ["o1",1,"온보딩 흐름 초안",false,null,"처음 가입한 사람이 첫 회의를 만들기까지의 단계를 그려 보고 단계가 많다는 점을 확인했어요.",0,1,null,"단계를 몇 개까지 줄일 수 있는지 확인이 필요해요."],
  ["b1",1,"베타 테스터 모집 계획",false,null,"베타 테스터 30명을 목표로 모집 시기와 대상을 정리했어요.",1,1,null,null],
  ["r1",1,"출시 전 체크리스트 범위",false,null,"출시 전에 확인할 항목을 결제, 알림, 약관 세 묶음으로 나눴어요.",1,0,null,null],
  ["x1",1,"팀 역할 분담",true,null,"출시 준비를 맡을 사람을 영역별로 정했어요.",1,2,null,null],
  ["p2",2,"요금제 경쟁사 비교",true,"p1","비슷한 서비스 네 곳의 요금과 무료 범위를 표로 비교했어요. 무료 체험이 있는 곳이 많았어요.",0,1,"무료 체험 기간을 두는 방향으로 검토합니다.",null],
  ["o2",2,"온보딩 단계 줄이기",false,"o1","가입 후 첫 회의까지 다섯 단계를 세 단계로 줄이는 안을 논의했어요.",1,1,null,"이메일 확인 단계를 뺄 수 있는지 확인이 필요해요."],
  ["b2",2,"베타 모집 채널 정하기",false,"b1","뉴스레터와 커뮤니티 두 곳에서 모집하기로 하고 안내 문구 초안을 맡았어요.",1,2,null,null],
  ["r2",2,"체크리스트 담당 배정",true,"r1","묶음별 담당자를 정하고 점검 날짜를 잡았어요.",1,1,null,null],
  ["x2",2,"주간 지표 공유",true,null,"가입자 수와 첫 회의 생성률을 공유했어요.",0,0,null,null],
  ["p3",3,"무료 체험 기간",false,"p2","체험 기간을 7일과 14일 중 무엇으로 할지 인터뷰 의견을 모아 논의했어요.",0,1,null,"14일이 부담스럽다는 의견이 있어 한 번 더 확인해요."],
  ["s1",3,"고객 문의 응대 방식",false,null,"문의가 늘 때를 대비해 답변 담당과 응답 시간 기준을 정했어요.",1,1,null,null],
  ["o3",3,"온보딩 이탈 구간",false,"o2","인터뷰에서 두 번째 단계에서 멈춘다는 이야기가 반복해서 나왔어요.",0,2,null,"이탈 원인이 문구인지 단계인지 구분이 필요해요."],
  ["b3",3,"인터뷰 대상 추가 모집",true,"b2","인터뷰할 고객을 다섯 명 더 모으기로 하고 일정을 잡았어요.",1,1,null,null],
  ["p4",3,"환불 정책",false,"p2","구독 환불을 며칠 안에 받을지 논의했고, 초안만 만들기로 했어요.",0,1,null,"법무 검토가 필요해요."],
  ["q1",4,"학생 할인 검토",false,"p3","대학생에게 체험 기간 뒤 첫 달 할인을 줄지 의견을 모았어요.",0,1,null,"할인 폭을 얼마로 할지 정해야 해요."],
  ["p5",4,"체험 기간 14일로 확정",true,"p3","체험 기간을 14일로 하고, 종료 3일 전에 알림을 보내기로 했어요.",2,1,"체험 기간은 14일로 합니다.",null],
  ["o4",4,"온보딩 화면 시안",true,"o3","두 번째 단계를 합친 새 화면 시안을 검토하고 문구를 다듬었어요.",1,2,"시안 B로 진행합니다.",null],
  ["b4",4,"모집 문구 검토",true,"b3","신청서 문구에서 길게 느껴지는 질문을 줄이기로 했어요.",1,1,null,null],
  ["r3",4,"체크리스트 1차 점검",false,"r2","결제 묶음은 끝났고 알림 묶음에서 두 항목이 남았어요.",0,2,null,"약관 항목은 아직 시작하지 못했어요."],
  ["n1",4,"알림 설정 화면",false,null,"알림을 종류별로 끄고 켤 수 있는 화면의 구성을 검토했어요.",1,1,null,null],
  ["p6",5,"요금제 안내 페이지 문구",false,"p5","요금제 비교 표와 체험 안내 문구 초안을 읽고 고쳤어요.",1,1,null,null],
  ["p7",5,"환불 기준 확정",true,"p4","구독 후 7일 안에는 환불하는 것으로 확정했어요.",1,1,"결제 후 7일 이내 환불로 합니다.",null],
  ["o5",5,"온보딩 사용성 시험",false,"o4","다섯 명에게 새 시안을 써 보게 했고 네 명이 막힘 없이 끝냈어요.",0,2,null,"막힌 한 명의 원인을 따로 확인해요."],
  ["b5",5,"베타 신청자 선별",false,"b4","신청자 80명 중 사용 목적이 분명한 40명을 먼저 추렸어요.",1,1,null,null],
  ["b6",5,"베타 일정 확정",true,"b5","베타를 2주 동안 진행하고 첫 안내 메일을 이번 주에 보내기로 했어요.",2,1,"베타는 2주간 진행합니다.",null],
  ["s2",5,"문의 응대 가이드",true,"s1","자주 오는 문의 열 가지에 대한 답변 문구를 모았어요.",0,1,null,null],
  ["r4",5,"체크리스트 2차 점검",false,"r3","알림 묶음이 끝났고 약관 항목 검토를 시작했어요.",0,1,null,null],
  ["q2",6,"학생 인증 방식",false,"q1","학생임을 확인하는 방법을 메일 인증으로 단순하게 가자는 쪽으로 모였어요.",1,1,null,null],
  ["p8",6,"요금제 페이지 검수",true,"p6","페이지의 가격과 체험 안내가 결정 내용과 같은지 하나씩 확인했어요.",0,1,null,null],
  ["o6",6,"온보딩 개선안 반영",false,"o5","시험에서 나온 문구 수정 세 가지를 반영하기로 했어요.",1,2,null,null],
  ["b7",6,"베타 피드백 1차",false,"b6","첫 주에 들어온 의견 열두 건을 분류했어요. 알림이 많다는 의견이 가장 많았어요.",0,2,null,"의견을 우선순위로 나눠야 해요."],
  ["r5",6,"체크리스트 3차 점검",false,"r4","약관 항목이 남았고 나머지는 점검을 마쳤어요.",0,1,null,null],
  ["n2",6,"알림 문구 검토",true,"n1","알림 문구를 짧게 줄이고 말투를 통일했어요.",1,1,null,null],
  ["x3",6,"스토어 심사 준비",false,null,"심사에 필요한 설명과 화면 캡처 목록을 정리했어요.",0,2,null,null],
  ["p9",7,"출시 가격 최종 확인",true,"p8","출시 당일 적용할 가격표를 확인하고 변경이 없음을 정했어요.",1,0,"가격표는 지금 그대로 출시합니다.",null],
  ["o7",7,"온보딩 완료율 확인",false,"o6","개선안을 반영한 뒤 첫 회의 생성률이 눈에 띄게 올랐는지 확인했어요.",0,1,null,"출시 후 2주 동안 계속 지켜봐요."],
  ["b8",7,"베타 피드백 반영 목록",false,"b7","출시 전에 고칠 의견 다섯 건과 출시 뒤로 미룰 의견을 나눴어요.",2,2,null,null],
  ["r6",7,"출시 일정 최종 점검",false,"r5","남은 약관 항목만 끝나면 일정대로 출시할 수 있다고 확인했어요.",1,2,null,"약관 검토 결과가 늦어지면 일정을 다시 봐요."],
  ["r7",7,"출시 공지 초안",false,"r6","출시 공지에 들어갈 내용을 정리하고 초안 담당을 정했어요.",0,1,null,null],
  ["n3",7,"알림 발송 시간",false,"n2","알림을 보내는 시간대를 오전 10시 전후로 맞추기로 했어요.",1,1,null,null],
  ["s3",7,"문의 접수 창구 점검",true,"s2","출시 뒤 문의가 모이는 창구와 확인 주기를 점검했어요.",0,1,null,null],];

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
    description: "새 앱의 출시를 준비하는 프로젝트입니다.",
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
