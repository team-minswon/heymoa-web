import type { ProjectMeetingLinksResponseData } from "@/lib/api/generated/models";
import type { MeetingReviewSummary } from "@/lib/notes/review/summary";

/**
 * 프로젝트 안건 지도(APP-1455)의 목. `noteId` 없이 프로젝트 전체 회의 간 연결을 물으면 이 여덟 회의를 돌려준다.
 * 같은 회의 안 이어짐(결제 재논의 → PG 선정 등)과 다른 회의로의 이어짐, 이어짐 없는 안건이 섞여 있다.
 * 노트 자체는 목 DB 에 없어 「요약에서 보기」는 목에서 빈 노트로 간다.
 */
// 간격을 일부러 고르지 않게 둔다 — 이틀 뒤 회의, 2주 공백, 연이은 이틀이 실제 날짜 간격 배치에서 보인다
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

// [회의 번호(1부터), 안건 제목, 완료, 이어진 앞 안건 번호]
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

// 계약의 TSID 꼴(Crockford base32 13자). 숫자만 써서 I·L·O·U 를 피한다
const noteId = (n: number) => `0PM0000000${String(n).padStart(3, "0")}`;
const agendaId = (n: number) => `0PA0000000${String(n).padStart(3, "0")}`;

/**
 * 실제 프로젝트 데이터로 보고 싶을 때의 목 손잡이. 브라우저 콘솔에서
 * `localStorage.mockAgendaMapSample = JSON.stringify(<meeting-links 응답의 data>)` 뒤 새로고침하면 그것을 돌려준다.
 * 지우면(`localStorage.removeItem("mockAgendaMapSample")`) 아래 여덟 회의로 돌아간다. 데이터는 레포에 두지 않는다.
 */
function storedSample(): ProjectMeetingLinksResponseData | null {
  try {
    const raw = typeof localStorage === "undefined" ? null : localStorage.getItem("mockAgendaMapSample");
    return raw ? (JSON.parse(raw) as ProjectMeetingLinksResponseData) : null;
  } catch {
    return null;
  }
}

/**
 * 회의가 많은 프로젝트를 보는 손잡이. 브라우저 콘솔에서 `localStorage.mockAgendaMapSize = "150"` 뒤 새로고침하면 회의
 * 150개짜리 지도를 돌려준다(숫자는 회의 수). 시드를 고정해 매번 같다. 지우면 원래 목으로 돌아간다. 실제 데이터 손잡이보다
 * 먼저 본다.
 */
function storedSize(): number | null {
  try {
    const raw = typeof localStorage === "undefined" ? null : localStorage.getItem("mockAgendaMapSize");
    const size = raw ? Number.parseInt(raw, 10) : NaN;
    return Number.isFinite(size) && size > 0 ? Math.min(size, 400) : null;
  } catch {
    return null;
  }
}

/** 시드를 고정한 난수(mulberry32). 같은 시드면 같은 수열이다 */
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

/** 회의 뒤 분석이 앞선 안건을 찾는 범위(운영 `ANALYSIS_PRIOR_NOTES`). 이보다 오래된 회의와는 잇지 않는다 */
const PRIOR_NOTES = 30;

/**
 * 회의 `size` 개짜리 큰 지도. 이어짐은 heymoa-ai 의 안건 이어짐 판정(`agenda_link_graph`)을 흉내 낸다.
 * - 안건마다 앞 안건은 많아야 하나다. 관련 후보 가운데 가장 늦은 것을 고른다(프롬프트 `meeting/agenda-chain`)
 * - 후보는 최근 `PRIOR_NOTES` 개 회의의 안건 중 비슷한 것과 그 사슬의 끝, 그리고 같은 회의의 앞 안건이다
 * - 그래서 대개 사슬 끝에 붙지만, 몇 회의를 건너뛰거나(같은 주제를 한동안 안 다룸), 같은 회의 안에서 잇거나,
 *   두 안건이 같은 끝을 고르거나 사슬 중간에 붙어 갈라진다
 * - 소속 명제가 없는 안건은 판정에 오르지 않아 앞 안건이 없다
 * 비율은 실제 프로젝트 하나(회의 5개 · 안건 41개 · 이어짐 21개 중 건너뜀 5 · 같은 회의 5 · 갈라짐 5)에 맞췄다.
 */
function largeAgendaMap(size: number): ProjectMeetingLinksResponseData {
  const random = seeded(1455);
  const pick = <T,>(list: readonly T[]) => list[Math.floor(random() * list.length)];
  // 마지막 회의가 2026-10-24 가 되게 간격을 먼저 뽑고 거꾸로 센다
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
    // 최근 회의에서 아직 사슬 끝인 안건. 최근일수록 다시 다뤄질 가능성이 크다
    const recent = placed.filter((agenda) => agenda.meeting >= index - PRIOR_NOTES && agenda.meeting < index);
    for (let order = 0; order < room; order += 1) {
      agendaCount += 1;
      const agendaId = largeAgendaId(agendaCount);
      const here: Placed[] = placed.filter((agenda) => agenda.noteId === noteId);
      let parent: Placed | undefined;
      const roll = random();
      // 명제가 없는 안건(약 15%)은 판정에 오르지 않는다
      const judged = random() > 0.15;
      if (judged && roll < 0.33) {
        // 다른 회의의 사슬 끝. 최근 회의일수록 잘 고른다 — 바로 앞 회의가 아니면 그 사이를 건너뛴 것이다
        const tips = recent.filter((agenda) => agenda.tip);
        const weighted = tips.filter((agenda) => random() < Math.pow(0.5, index - 1 - agenda.meeting));
        parent = weighted.length > 0 ? pick(weighted) : undefined;
      } else if (judged && roll < 0.47 && here.length > 0) {
        parent = pick(here);
      } else if (judged && roll < 0.5) {
        // 끝이 후보에 안 들어 사슬 중간에 붙는다 — 거기서 갈라진다
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

/**
 * 지도 목 노트의 회의록 요약. 목 노트 DB 에 없는 노트라 회의록 목이 모르므로 여기서 만든다. 안건마다 한 줄 요약과
 * 결정·할 일, 셋에 하나꼴로 결론·남은 질문을 단다. 지도 목 노트가 아니면 null.
 */
export function projectAgendaMapSummary(noteId: string): MeetingReviewSummary | null {
  const note = projectAgendaMapMock().notes.find((candidate) => candidate.noteId === noteId);
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

export function projectAgendaMapMock(): ProjectMeetingLinksResponseData {
  const size = storedSize();
  if (size) return largeAgendaMap(size);
  const sample = storedSample();
  if (sample) return sample;
  return {
    // 서버처럼 최근 순
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
