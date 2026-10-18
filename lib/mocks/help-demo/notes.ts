import type { SmallKey } from "@/lib/mocks/help-demo/small";
import type { PersonRef, ProjectKey } from "@/lib/mocks/help-demo/people";

/** 가이드 캡처 스크립트가 쓰는 핵심 회의 3개의 ID. */
export const HD_NOTE_IDS = {
  campaign: "01KH000001001",
  landing: "01KH000001002",
  weekly: "01KH000001003",
} as const;

export type MidKey = "visual" | "abtest" | "launch" | "mail" | "int3" | "int2" | "weeklyPast" | "brand";

export type NoteDef = {
  key: string;
  noteId: string;
  title: string;
  project: ProjectKey;
  /** 오늘에서 며칠 전의 회의인가(앱 타임존 날짜 기준). 시작 전 회의는 만든 날이다 */
  daysAgo: number;
  /** 앱 타임존의 시작 시각(시) */
  hour: number;
  status: "ENDED" | "IN_PROGRESS" | "NOT_STARTED" | "PAUSED";
  /** 참석자. 목록 아바타 순서와 무관하다(서버처럼 이름순으로 정렬해 내린다) */
  people: PersonRef[];
  /** 회의를 시작한 사람. 시작 전이면 없다 */
  starter?: PersonRef;
  /** 화자 라벨 A, B, C … 가 가리키는 사람. `null` 은 아직 지정하지 않은 화자 */
  speakers?: Array<PersonRef | null>;
  /** 전사 */
  source?: { kind: "core"; id: keyof typeof HD_NOTE_IDS } | { kind: "mid"; id: MidKey } | { kind: "small"; id: SmallKey };
  context?: { topic: string; background: string };
};

const note = (def: NoteDef) => def;

/** 30개. 날짜는 오늘·어제·이번 주·지난주·이번 달·지난달에 걸쳐 흩어진다. */
export const NOTE_DEFS: NoteDef[] = [
  // ── 오늘 ──
  note({
    key: "weekly", noteId: HD_NOTE_IDS.weekly, title: "주간 운영 점검", project: "weekly", daysAgo: 0, hour: 10,
    status: "IN_PROGRESS", people: ["seoyun", "yuna", "jiho", "sera", "doyun"], starter: "yuna",
    source: { kind: "core", id: "weekly" },
    context: {
      topic: "문의 응대 지연 원인과 배송 지연 보상 기준",
      background: "지난주 첫 응답 시간이 목표를 넘겼고, 같은 택배사 구간에서 지연 신고가 몰렸습니다. 오늘은 원인과 보상 기준을 정합니다.",
    },
  }),
  note({
    key: "inquiryRule", noteId: "01KH000001004", title: "고객 문의 응대 기준 정리", project: "weekly", daysAgo: 0, hour: 9,
    status: "ENDED", people: ["yuna", "jiho", "sera"], starter: "yuna", speakers: ["yuna", "jiho", "sera"],
    source: { kind: "small", id: "inquiryRule" },
  }),
  note({
    key: "mayIdeas", noteId: "01KH000001005", title: "5월 캠페인 아이디어 회의", project: "spring", daysAgo: 0, hour: 15,
    status: "NOT_STARTED", people: ["seoyun", "harin", "doyun", "minjae", "yuna", "sera"],
    context: { topic: "5월 캠페인 콘셉트와 후보 3개 고르기", background: "4월 성과 리뷰에서 후기 소재와 리타겟팅의 반응이 좋았습니다. 그 방향을 이어 갈 콘셉트를 모읍니다." },
  }),
  // ── 어제 ──
  note({
    key: "campaign", noteId: HD_NOTE_IDS.campaign, title: "4월 캠페인 성과 리뷰", project: "spring", daysAgo: 1, hour: 14,
    status: "ENDED", people: ["seoyun", "doyun", "harin", "minjae", "yuna", "g:taeo"], starter: "seoyun",
    // 화자 4명 중 앞 둘만 참석자에 연결돼 있고 C·D 는 아직 지정 전이다
    speakers: ["doyun", "harin", null, null],
    source: { kind: "core", id: "campaign" },
    context: { topic: "4월 광고 성과와 5월 예산·목표", background: "4월 한 달 동안 검색·소셜·디스플레이·이메일 네 채널로 집행했습니다. 채널별 효율을 보고 5월 예산을 다시 나눕니다." },
  }),
  note({
    key: "launchSchedule", noteId: "01KH000001006", title: "출시 일정 점검", project: "launch", daysAgo: 2, hour: 11,
    status: "ENDED", people: ["seoyun", "sera", "jiho", "minjae"], starter: "sera", speakers: ["sera", "jiho", "minjae"],
    source: { kind: "mid", id: "launch" },
    context: { topic: "출시 3주 전 남은 일 점검", background: "사전 신청 페이지, 알림 메일, 결제 연동이 남았습니다. 날짜 기준으로 늦어지는 일이 있는지 봅니다." },
  }),
  // ── 이번 주 ──
  note({
    key: "landing", noteId: HD_NOTE_IDS.landing, title: "신제품 소개 페이지 문구 정리", project: "launch", daysAgo: 3, hour: 11,
    status: "ENDED", people: ["seoyun", "minjae", "sera", "jiho"], starter: "sera", speakers: ["sera", "minjae", "seoyun"],
    source: { kind: "core", id: "landing" },
    context: { topic: "소개 페이지의 제목, 혜택, 후기, 신청 버튼 문구 확정", background: "다음 주 월요일에 개발팀에 문구를 넘겨야 합니다. 시험 성적서가 필요한 표현은 쓰지 않습니다." },
  }),
  note({
    key: "int3", noteId: "01KH000001007", title: "고객 인터뷰 3차", project: "interview", daysAgo: 4, hour: 15,
    status: "ENDED", people: ["seoyun", "minjae", "doyun", "g:jian", "yuna"], starter: "minjae", speakers: ["minjae", "doyun", "seoyun"],
    source: { kind: "mid", id: "int3" },
    context: { topic: "3차 인터뷰 다섯 분의 후기·가격 반응 정리", background: "30대 직장인 다섯 분을 만났습니다. 구매 전 후기를 읽는 방식과 가격 반응을 중심으로 봅니다." },
  }),
  note({
    key: "brandDirection", noteId: "01KH000001008", title: "브랜드 리뉴얼 방향 논의", project: "brand", daysAgo: 5, hour: 13,
    status: "ENDED", people: ["seoyun", "harin", "minjae", "g:taeo", "g:sohee"], starter: "harin", speakers: ["harin", "minjae", "g:taeo"],
    source: { kind: "mid", id: "brand" },
    context: { topic: "로고와 색을 얼마나 바꿀지", background: "작은 크기에서 로고가 잘 안 보이고 주조색의 대비가 약합니다. 기존 이미지를 지킬지 바꿀지 정합니다." },
  }),
  note({
    key: "faq", noteId: "01KH000001009", title: "FAQ 초안 리뷰", project: "launch", daysAgo: 5, hour: 16,
    status: "PAUSED", people: ["seoyun", "sera"], starter: "sera",
  }),
  note({
    key: "visual", noteId: "01KH000001010", title: "봄 캠페인 키비주얼 시안 검토", project: "spring", daysAgo: 6, hour: 10,
    status: "ENDED", people: ["seoyun", "harin", "minjae", "doyun"], starter: "harin", speakers: ["harin", "minjae", "doyun"],
    source: { kind: "mid", id: "visual" },
  }),
  note({
    key: "interviewShare", noteId: "01KH000001011", title: "인터뷰 결과 공유", project: "interview", daysAgo: 7, hour: 14,
    status: "ENDED", people: ["seoyun", "minjae", "doyun", "sera", "yuna"], starter: "minjae", speakers: ["minjae", "doyun", "seoyun"],
    source: { kind: "small", id: "interviewShare" },
  }),
  // ── 지난주 ──
  note({
    key: "weeklyPast", noteId: "01KH000001012", title: "주간 운영 점검 (지난주)", project: "weekly", daysAgo: 8, hour: 10,
    status: "ENDED", people: ["seoyun", "yuna", "jiho", "sera"], starter: "yuna", speakers: ["yuna", "jiho", "sera"],
    source: { kind: "mid", id: "weeklyPast" },
  }),
  note({
    key: "influencer", noteId: "01KH000001013", title: "인플루언서 협업 일정 조율", project: "spring", daysAgo: 9, hour: 15,
    status: "ENDED", people: ["seoyun", "harin", "doyun", "g:sohee"], starter: "harin", speakers: ["harin", "doyun", "seoyun"],
    source: { kind: "small", id: "influencer" },
  }),
  note({
    key: "pricing", noteId: "01KH000001014", title: "가격 정책 최종 확인", project: "launch", daysAgo: 11, hour: 11,
    status: "ENDED", people: ["seoyun", "sera", "jiho", "harin"], starter: "sera", speakers: ["sera", "jiho", "seoyun"],
    source: { kind: "small", id: "pricing" },
  }),
  note({
    key: "dashboard", noteId: "01KH000001015", title: "운영 지표 대시보드 점검", project: "weekly", daysAgo: 12, hour: 14,
    status: "ENDED", people: ["seoyun", "yuna", "jiho", "sera"], starter: "jiho", speakers: ["yuna", "jiho", "seoyun"],
    source: { kind: "small", id: "dashboard" },
  }),
  // ── 이번 달 ──
  note({
    key: "logoReview", noteId: "01KH000001016", title: "로고 시안 1차 검토", project: "brand", daysAgo: 13, hour: 16,
    status: "ENDED", people: ["seoyun", "harin", "minjae", "g:taeo"], starter: "harin", speakers: ["harin", "minjae", "g:taeo"],
    source: { kind: "small", id: "logoReview" },
  }),
  note({
    key: "launchMail", noteId: "01KH000001017", title: "사전 신청 안내 메일 검토", project: "launch", daysAgo: 14, hour: 11,
    status: "ENDED", people: ["seoyun", "sera", "yuna"], starter: "yuna", speakers: ["sera", "yuna", "seoyun"],
    source: { kind: "mid", id: "mail" },
  }),
  note({
    key: "budgetShift", noteId: "01KH000001018", title: "캠페인 예산 재배분 논의", project: "spring", daysAgo: 16, hour: 10,
    status: "ENDED", people: ["seoyun", "harin", "doyun"], starter: "harin", speakers: ["harin", "doyun", "seoyun"],
    source: { kind: "small", id: "budgetShift" },
  }),
  note({
    key: "int2", noteId: "01KH000001019", title: "고객 인터뷰 2차", project: "interview", daysAgo: 19, hour: 15,
    status: "ENDED", people: ["seoyun", "minjae", "harin", "doyun", "g:jian"], starter: "minjae", speakers: ["minjae", "harin", "doyun"],
    source: { kind: "mid", id: "int2" },
  }),
  note({
    key: "monthlyRetro", noteId: "01KH000001020", title: "월간 운영 회고", project: "weekly", daysAgo: 21, hour: 16,
    status: "ENDED", people: ["seoyun", "yuna", "jiho", "sera", "harin"], starter: "yuna", speakers: ["yuna", "jiho", "sera"],
    source: { kind: "small", id: "monthlyRetro" },
  }),
  // ── 지난달 ──
  note({
    key: "abtest", noteId: "01KH000001021", title: "광고 소재 A/B 테스트 설계", project: "spring", daysAgo: 26, hour: 14,
    status: "ENDED", people: ["seoyun", "doyun", "minjae", "harin"], starter: "doyun", speakers: ["doyun", "minjae", "harin"],
    source: { kind: "mid", id: "abtest" },
  }),
  note({
    key: "brandGuide", noteId: "01KH000001022", title: "브랜드 가이드 초안 리뷰", project: "brand", daysAgo: 27, hour: 11,
    status: "ENDED", people: ["seoyun", "harin", "minjae", "g:taeo"], starter: "harin", speakers: ["harin", "minjae", "g:taeo"],
    source: { kind: "small", id: "guideReview" },
  }),
  note({
    key: "interviewQuestions", noteId: "01KH000001023", title: "인터뷰 질문지 점검", project: "interview", daysAgo: 33, hour: 13,
    status: "ENDED", people: ["seoyun", "minjae", "doyun"], starter: "minjae", speakers: ["minjae", "doyun", "seoyun"],
    source: { kind: "small", id: "interviewQuestions" },
  }),
  note({
    key: "packaging", noteId: "01KH000001024", title: "패키지 디자인 협의", project: "launch", daysAgo: 34, hour: 15,
    status: "ENDED", people: ["seoyun", "sera", "minjae", "g:taeo"], starter: "sera", speakers: ["sera", "minjae", "g:taeo"],
    source: { kind: "small", id: "packaging" },
  }),
  note({
    key: "tone", noteId: "01KH000001025", title: "톤앤매너 정리", project: "brand", daysAgo: 40, hour: 10,
    status: "ENDED", people: ["seoyun", "harin", "minjae", "yuna", "doyun"], starter: "harin", speakers: ["harin", "minjae", "yuna"],
    source: { kind: "small", id: "tone" },
  }),
  note({
    key: "kickoff", noteId: "01KH000001026", title: "봄 캠페인 킥오프", project: "spring", daysAgo: 48, hour: 14,
    status: "ENDED", people: ["seoyun", "harin", "doyun", "minjae", "yuna", "g:jaehyun"], starter: "harin", speakers: ["harin", "doyun", "minjae"],
    source: { kind: "small", id: "kickoff" },
  }),
  note({
    key: "recruiting", noteId: "01KH000001027", title: "인터뷰 참가자 모집 현황", project: "interview", daysAgo: 60, hour: 11,
    status: "ENDED", people: ["seoyun", "minjae", "g:jian"], starter: "minjae", speakers: ["minjae", "seoyun"],
    source: { kind: "small", id: "recruiting" },
  }),
  // ── 시작 전 ──
  note({
    key: "launchDay", noteId: "01KH000001028", title: "출시 당일 운영 시나리오", project: "launch", daysAgo: 0, hour: 11,
    status: "NOT_STARTED", people: ["seoyun", "sera", "jiho", "yuna"],
  }),
  note({
    key: "int4", noteId: "01KH000001029", title: "고객 인터뷰 4차 준비", project: "interview", daysAgo: 1, hour: 10,
    status: "NOT_STARTED", people: ["seoyun"],
  }),
  note({
    key: "holiday", noteId: "01KH000001030", title: "연휴 근무 일정 조정", project: "weekly", daysAgo: 2, hour: 15,
    status: "NOT_STARTED", people: ["yuna", "jiho"],
  }),
];
