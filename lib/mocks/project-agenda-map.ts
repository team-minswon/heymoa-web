import type { ProjectMeetingLinksResponseData } from "@/lib/api/generated/models";
import { GUIDE_AGENDA_PROJECT_ID } from "@/lib/mocks/guide-agenda-map";
import { helpDemoPack, isHelpDemoEnabled } from "@/lib/mocks/help-demo";
import { localProjectLinks, localProjects } from "@/lib/mocks/local-projects";
import type { MeetingReviewSummary } from "@/lib/notes/review/summary";

const meetings = [
  ["07-01", "킥오프"],
  ["07-03", "주간 회의"],
  ["07-10", "결제 재검토"],
  ["07-24", "디자인 리뷰"],
  ["07-31", "주간 회의"],
  ["08-01", "베타 준비"],
  ["08-12", "주간 회의"],
  ["08-19", "베타 회고"],
] as const;

const agendas: ReadonlyArray<readonly [number, string, boolean, number?]> = [
  [1, "결제 수단 검토", true], [1, "온보딩 흐름", false], [1, "출시 목표 일정", true], [1, "팀 역할 분담", true],
  [2, "온보딩 단계 수", false, 2], [2, "푸시 알림 빈도", false], [2, "디자인 시스템 도입", true], [2, "주간 지표 공유", true],
  [3, "결제 수단 재논의", true, 1], [3, "간편결제 PG 선정", false, 9], [3, "환불 정책", false],
  [4, "온보딩 화면 확정", true, 5], [4, "알림 설정 화면", true, 6], [4, "디자인 토큰 정리", true, 7], [4, "접근성 점검", false, 14],
  [5, "간편결제 연동 일정", false, 10], [5, "환불 정책 확정", true, 11], [5, "베타 범위", false, 3], [5, "채용 현황", true],
  [6, "베타 테스터 모집", true, 18], [6, "간편결제 QA", false, 16], [6, "알림 문구 검토", true, 13], [6, "버그 분류 기준", true, 21],
  [7, "베타 피드백 1차", false, 20], [7, "간편결제 QA 결과", true, 21], [7, "온보딩 이탈률", false, 12], [7, "스프린트 회고 방식", true],
  [8, "베타 회고", true, 24], [8, "정식 출시 일정", false, 28], [8, "온보딩 개선안", false, 26], [8, "다음 분기 로드맵", false, 29],
];

const noteId = (n: number) => `0PM0000000${String(n).padStart(3, "0")}`;
const agendaId = (n: number) => `0PA0000000${String(n).padStart(3, "0")}`;

function storedSample(): ProjectMeetingLinksResponseData | null {
  try {
    const raw = typeof localStorage === "undefined" ? null : localStorage.getItem("mockAgendaMapSample");
    return raw ? (JSON.parse(raw) as ProjectMeetingLinksResponseData) : null;
  } catch {
    return null;
  }
}

function storedSize(): number | null {
  try {
    const raw = typeof localStorage === "undefined" ? null : localStorage.getItem("mockAgendaMapSize");
    const size = raw ? Number.parseInt(raw, 10) : NaN;
    return Number.isFinite(size) && size > 0 ? Math.min(size, 400) : null;
  } catch {
    return null;
  }
}

function seeded(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SUBJECTS = ["결제", "온보딩", "알림", "검색", "권한", "대시보드", "요금제", "모바일 앱", "데이터 이전", "보안 점검", "고객 지원", "추천", "리포트", "API", "디자인 시스템", "성능", "로그인", "파트너 연동", "릴리스", "채용"];
const ASPECTS = ["범위 정리", "일정 조율", "우선순위", "설계 검토", "QA 결과", "지표 확인", "리스크 점검", "후속 작업", "정책 확정", "문구 검토", "배포 계획", "비용 산정"];
const largeNoteId = (n: number) => `0PL${String(n).padStart(10, "0")}`;
const largeAgendaId = (n: number) => `0PB${String(n).padStart(10, "0")}`;

const PRIOR_NOTES = 30;

function largeAgendaMap(size: number): ProjectMeetingLinksResponseData {
  const random = seeded(1455);
  const pick = <T,>(list: readonly T[]) => list[Math.floor(random() * list.length)];
  const gaps = Array.from({ length: size }, () => 1 + Math.floor(random() * 14));
  let day = Date.parse("2026-10-24T01:00:00Z") - gaps.reduce((sum, gap) => sum + gap, 0) * 86_400_000;
  let agendaCount = 0;
  type Placed = { agendaId: string; noteId: string; meeting: number; subject: string; tip: boolean };
  const placed: Placed[] = [];
  const notes: ProjectMeetingLinksResponseData["notes"] = [];
  const agendaLinks: ProjectMeetingLinksResponseData["agendaLinks"] = [];

  for (let index = 0; index < size; index += 1) {
    day += gaps[index] * 86_400_000;
    const noteId = largeNoteId(index + 1);
    const agendas: ProjectMeetingLinksResponseData["notes"][number]["agendas"] = [];
    const room = 4 + Math.floor(random() * 10);
    const recent = placed.filter((agenda) => agenda.meeting >= index - PRIOR_NOTES && agenda.meeting < index);
    for (let order = 0; order < room; order += 1) {
      agendaCount += 1;
      const agendaId = largeAgendaId(agendaCount);
      const here: Placed[] = placed.filter((agenda) => agenda.noteId === noteId);
      let parent: Placed | undefined;
      const roll = random();
      const judged = random() > 0.15;
      if (judged && roll < 0.33) {
        const tips = recent.filter((agenda) => agenda.tip);
        const weighted = tips.filter((agenda) => random() < Math.pow(0.5, index - 1 - agenda.meeting));
        parent = weighted.length > 0 ? pick(weighted) : undefined;
      } else if (judged && roll < 0.47 && here.length > 0) {
        parent = pick(here);
      } else if (judged && roll < 0.5) {
        const middle = recent.filter((agenda) => !agenda.tip);
        parent = middle.length > 0 ? pick(middle) : undefined;
      }
      const subject = parent?.subject ?? pick(SUBJECTS);
      agendas.push({ agendaId, title: `${subject} ${pick(ASPECTS)}`, completed: random() < 0.55, proposalIds: [] });
      if (parent) {
        agendaLinks.push({ source: { noteId, agendaId }, target: { noteId: parent.noteId, agendaId: parent.agendaId } });
        parent.tip = false;
      }
      placed.push({ agendaId, noteId, meeting: index, subject, tip: true });
    }
    notes.push({
      noteId,
      title: index % 4 === 0 ? "주간 회의" : `${pick(SUBJECTS)} 논의`,
      startedAt: new Date(day).toISOString(),
      agendas,
    });
  }
  return { notes: notes.reverse(), agendaLinks, meetingLinks: [], conflicts: [] };
}

export function projectAgendaMapSummary(noteId: string): MeetingReviewSummary | null {
  const guide = isHelpDemoEnabled() ? helpDemoPack().agendaMap.summary(noteId) : null;
  if (guide) return guide;
  const note = [...localProjects().flatMap((project) => project.links.notes), ...projectAgendaMapMock().notes].find(
    (candidate) => candidate.noteId === noteId
  );
  if (!note) return null;
  const random = seeded(noteId.split("").reduce((sum, char) => sum * 31 + char.charCodeAt(0), 7));
  return {
    noteId,
    status: "SUCCEEDED",
    resultVersion: "1",
    headline: null,
    lead: [],
    topics: [],
    agendas: note.agendas.map((agenda, at) => {
      const detailed = random() < 0.34;
      const members = [
        ...Array.from({ length: Math.floor(random() * 3) }, (_, n) => ({ itemId: `${agenda.agendaId}-d${n}`, kind: "DECISION" as const })),
        ...Array.from({ length: Math.floor(random() * 3) }, (_, n) => ({ itemId: `${agenda.agendaId}-t${n}`, kind: "ACTION_ITEM" as const })),
      ];
      return {
        agendaId: agenda.agendaId,
        title: agenda.title,
        ordinal: at + 1,
        completed: agenda.completed,
        summary: `${agenda.title}을(를) 두고 지난 논의를 이어 받아 다음 단계와 담당을 정리했습니다.`,
        description: [],
        conclusions: detailed ? [{ itemIds: [], text: `${agenda.title}은(는) 이번 범위로 진행하기로 했습니다.` }] : [],
        openItems: detailed ? [{ itemIds: [], text: "세부 일정은 다음 회의에서 다시 확인합니다." }] : [],
        sentences: [],
        members,
        memberships: [],
        relations: [],
        alsoItemIds: [],
        openItemIds: [],
        agendaItemId: null,
        centerItemId: null,
      };
    }),
  };
}

export function projectAgendaMapMock(projectId?: string): ProjectMeetingLinksResponseData {
  if (projectId === GUIDE_AGENDA_PROJECT_ID && isHelpDemoEnabled()) return helpDemoPack().agendaMap.links();
  const local = projectId ? localProjectLinks(projectId) : null;
  if (local) return local;
  const size = storedSize();
  if (size) return largeAgendaMap(size);
  const sample = storedSample();
  if (sample) return sample;
  return {
    notes: meetings
      .map(([date, title], index) => ({
        noteId: noteId(index + 1),
        title,
        startedAt: `2026-${date}T01:00:00.000Z`,
        agendas: agendas.flatMap(([meeting, agendaTitle, completed], at) =>
          meeting === index + 1 ? [{ agendaId: agendaId(at + 1), title: agendaTitle, completed, proposalIds: [] }] : []
        ),
      }))
      .reverse(),
    agendaLinks: agendas.flatMap(([meeting, , , previous], at) =>
      previous === undefined
        ? []
        : [
            {
              source: { noteId: noteId(meeting), agendaId: agendaId(at + 1) },
              target: { noteId: noteId(agendas[previous - 1][0]), agendaId: agendaId(previous) },
            },
          ]
    ),
    meetingLinks: [],
    conflicts: [],
  };
}
