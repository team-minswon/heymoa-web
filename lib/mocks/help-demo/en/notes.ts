import type { SmallKey } from "@/lib/mocks/help-demo/en/small";
import type { PersonRef, ProjectKey } from "@/lib/mocks/help-demo/en/people";

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
    key: "weekly", noteId: HD_NOTE_IDS.weekly, title: "Weekly ops check-in", project: "weekly", daysAgo: 0, hour: 10,
    status: "IN_PROGRESS", people: ["seoyun", "yuna", "jiho", "sera", "doyun"], starter: "yuna",
    source: { kind: "core", id: "weekly" },
    context: {
      topic: "Why support replies are slow, and how we compensate for late deliveries",
      background: "Last week our first response time missed the target, and most late-delivery reports came from one carrier route. Today we pin down the cause and set the compensation rule.",
    },
  }),
  note({
    key: "inquiryRule", noteId: "01KH000001004", title: "Support reply guidelines", project: "weekly", daysAgo: 0, hour: 9,
    status: "ENDED", people: ["yuna", "jiho", "sera"], starter: "yuna", speakers: ["yuna", "jiho", "sera"],
    source: { kind: "small", id: "inquiryRule" },
  }),
  note({
    key: "mayIdeas", noteId: "01KH000001005", title: "May campaign brainstorm", project: "spring", daysAgo: 0, hour: 15,
    status: "NOT_STARTED", people: ["seoyun", "harin", "doyun", "minjae", "yuna", "sera"],
    context: { topic: "Pick three concepts for the May campaign", background: "The April review showed that review-based creative and retargeting performed well. We're gathering concepts that build on that." },
  }),
  // ── 어제 ──
  note({
    key: "campaign", noteId: HD_NOTE_IDS.campaign, title: "April campaign performance review", project: "spring", daysAgo: 1, hour: 14,
    status: "ENDED", people: ["seoyun", "doyun", "harin", "minjae", "yuna", "g:taeo"], starter: "seoyun",
    // 화자 4명 중 앞 둘만 참석자에 연결돼 있고 C·D 는 아직 지정 전이다
    speakers: ["doyun", "harin", null, null],
    source: { kind: "core", id: "campaign" },
    context: { topic: "April ad results and May budget and targets", background: "In April we ran ads on four channels: search, social, display, and email. We'll compare channel efficiency and reallocate the May budget." },
  }),
  note({
    key: "launchSchedule", noteId: "01KH000001006", title: "Launch timeline check", project: "launch", daysAgo: 2, hour: 11,
    status: "ENDED", people: ["seoyun", "sera", "jiho", "minjae"], starter: "sera", speakers: ["sera", "jiho", "minjae"],
    source: { kind: "mid", id: "launch" },
    context: { topic: "What's left three weeks before launch", background: "The waitlist page, reminder emails, and checkout integration are still open. We're checking whether anything is slipping against the dates." },
  }),
  // ── 이번 주 ──
  note({
    key: "landing", noteId: HD_NOTE_IDS.landing, title: "New product landing page copy", project: "launch", daysAgo: 3, hour: 11,
    status: "ENDED", people: ["seoyun", "minjae", "sera", "jiho"], starter: "sera", speakers: ["sera", "minjae", "seoyun"],
    source: { kind: "core", id: "landing" },
    context: { topic: "Lock the headline, benefits, reviews, and sign-up button copy", background: "Copy goes to the dev team next Monday. We won't use any claim that needs a lab report to back it up." },
  }),
  note({
    key: "int3", noteId: "01KH000001007", title: "Customer interviews, round 3", project: "interview", daysAgo: 4, hour: 15,
    status: "ENDED", people: ["seoyun", "minjae", "doyun", "g:jian", "yuna"], starter: "minjae", speakers: ["minjae", "doyun", "seoyun"],
    source: { kind: "mid", id: "int3" },
    context: { topic: "Reviews and price reactions from five round 3 interviews", background: "We talked to five working professionals in their 30s. The focus is how they read reviews before buying and how they react to the price." },
  }),
  note({
    key: "brandDirection", noteId: "01KH000001008", title: "Brand refresh direction", project: "brand", daysAgo: 5, hour: 13,
    status: "ENDED", people: ["seoyun", "harin", "minjae", "g:taeo", "g:sohee"], starter: "harin", speakers: ["harin", "minjae", "g:taeo"],
    source: { kind: "mid", id: "brand" },
    context: { topic: "How much to change the logo and colors", background: "The logo is hard to read at small sizes and the main color has weak contrast. We need to decide whether to keep the current look or move away from it." },
  }),
  note({
    key: "faq", noteId: "01KH000001009", title: "FAQ draft review", project: "launch", daysAgo: 5, hour: 16,
    status: "PAUSED", people: ["seoyun", "sera"], starter: "sera",
  }),
  note({
    key: "visual", noteId: "01KH000001010", title: "Spring campaign key visual review", project: "spring", daysAgo: 6, hour: 10,
    status: "ENDED", people: ["seoyun", "harin", "minjae", "doyun"], starter: "harin", speakers: ["harin", "minjae", "doyun"],
    source: { kind: "mid", id: "visual" },
  }),
  note({
    key: "interviewShare", noteId: "01KH000001011", title: "Interview findings share-out", project: "interview", daysAgo: 7, hour: 14,
    status: "ENDED", people: ["seoyun", "minjae", "doyun", "sera", "yuna"], starter: "minjae", speakers: ["minjae", "doyun", "seoyun"],
    source: { kind: "small", id: "interviewShare" },
  }),
  // ── 지난주 ──
  note({
    key: "weeklyPast", noteId: "01KH000001012", title: "Weekly ops check-in (last week)", project: "weekly", daysAgo: 8, hour: 10,
    status: "ENDED", people: ["seoyun", "yuna", "jiho", "sera"], starter: "yuna", speakers: ["yuna", "jiho", "sera"],
    source: { kind: "mid", id: "weeklyPast" },
  }),
  note({
    key: "influencer", noteId: "01KH000001013", title: "Influencer collab scheduling", project: "spring", daysAgo: 9, hour: 15,
    status: "ENDED", people: ["seoyun", "harin", "doyun", "g:sohee"], starter: "harin", speakers: ["harin", "doyun", "seoyun"],
    source: { kind: "small", id: "influencer" },
  }),
  note({
    key: "pricing", noteId: "01KH000001014", title: "Final pricing check", project: "launch", daysAgo: 11, hour: 11,
    status: "ENDED", people: ["seoyun", "sera", "jiho", "harin"], starter: "sera", speakers: ["sera", "jiho", "seoyun"],
    source: { kind: "small", id: "pricing" },
  }),
  note({
    key: "dashboard", noteId: "01KH000001015", title: "Ops metrics dashboard review", project: "weekly", daysAgo: 12, hour: 14,
    status: "ENDED", people: ["seoyun", "yuna", "jiho", "sera"], starter: "jiho", speakers: ["yuna", "jiho", "seoyun"],
    source: { kind: "small", id: "dashboard" },
  }),
  // ── 이번 달 ──
  note({
    key: "logoReview", noteId: "01KH000001016", title: "Logo concepts, first review", project: "brand", daysAgo: 13, hour: 16,
    status: "ENDED", people: ["seoyun", "harin", "minjae", "g:taeo"], starter: "harin", speakers: ["harin", "minjae", "g:taeo"],
    source: { kind: "small", id: "logoReview" },
  }),
  note({
    key: "launchMail", noteId: "01KH000001017", title: "Waitlist email review", project: "launch", daysAgo: 14, hour: 11,
    status: "ENDED", people: ["seoyun", "sera", "yuna"], starter: "yuna", speakers: ["sera", "yuna", "seoyun"],
    source: { kind: "mid", id: "mail" },
  }),
  note({
    key: "budgetShift", noteId: "01KH000001018", title: "Campaign budget reallocation", project: "spring", daysAgo: 16, hour: 10,
    status: "ENDED", people: ["seoyun", "harin", "doyun"], starter: "harin", speakers: ["harin", "doyun", "seoyun"],
    source: { kind: "small", id: "budgetShift" },
  }),
  note({
    key: "int2", noteId: "01KH000001019", title: "Customer interviews, round 2", project: "interview", daysAgo: 19, hour: 15,
    status: "ENDED", people: ["seoyun", "minjae", "harin", "doyun", "g:jian"], starter: "minjae", speakers: ["minjae", "harin", "doyun"],
    source: { kind: "mid", id: "int2" },
  }),
  note({
    key: "monthlyRetro", noteId: "01KH000001020", title: "Monthly ops retro", project: "weekly", daysAgo: 21, hour: 16,
    status: "ENDED", people: ["seoyun", "yuna", "jiho", "sera", "harin"], starter: "yuna", speakers: ["yuna", "jiho", "sera"],
    source: { kind: "small", id: "monthlyRetro" },
  }),
  // ── 지난달 ──
  note({
    key: "abtest", noteId: "01KH000001021", title: "Ad creative A/B test plan", project: "spring", daysAgo: 26, hour: 14,
    status: "ENDED", people: ["seoyun", "doyun", "minjae", "harin"], starter: "doyun", speakers: ["doyun", "minjae", "harin"],
    source: { kind: "mid", id: "abtest" },
  }),
  note({
    key: "brandGuide", noteId: "01KH000001022", title: "Brand guide draft review", project: "brand", daysAgo: 27, hour: 11,
    status: "ENDED", people: ["seoyun", "harin", "minjae", "g:taeo"], starter: "harin", speakers: ["harin", "minjae", "g:taeo"],
    source: { kind: "small", id: "guideReview" },
  }),
  note({
    key: "interviewQuestions", noteId: "01KH000001023", title: "Interview question review", project: "interview", daysAgo: 33, hour: 13,
    status: "ENDED", people: ["seoyun", "minjae", "doyun"], starter: "minjae", speakers: ["minjae", "doyun", "seoyun"],
    source: { kind: "small", id: "interviewQuestions" },
  }),
  note({
    key: "packaging", noteId: "01KH000001024", title: "Packaging design sync", project: "launch", daysAgo: 34, hour: 15,
    status: "ENDED", people: ["seoyun", "sera", "minjae", "g:taeo"], starter: "sera", speakers: ["sera", "minjae", "g:taeo"],
    source: { kind: "small", id: "packaging" },
  }),
  note({
    key: "tone", noteId: "01KH000001025", title: "Voice and tone guidelines", project: "brand", daysAgo: 40, hour: 10,
    status: "ENDED", people: ["seoyun", "harin", "minjae", "yuna", "doyun"], starter: "harin", speakers: ["harin", "minjae", "yuna"],
    source: { kind: "small", id: "tone" },
  }),
  note({
    key: "kickoff", noteId: "01KH000001026", title: "Spring campaign kickoff", project: "spring", daysAgo: 48, hour: 14,
    status: "ENDED", people: ["seoyun", "harin", "doyun", "minjae", "yuna", "g:jaehyun"], starter: "harin", speakers: ["harin", "doyun", "minjae"],
    source: { kind: "small", id: "kickoff" },
  }),
  note({
    key: "recruiting", noteId: "01KH000001027", title: "Interview recruiting status", project: "interview", daysAgo: 60, hour: 11,
    status: "ENDED", people: ["seoyun", "minjae", "g:jian"], starter: "minjae", speakers: ["minjae", "seoyun"],
    source: { kind: "small", id: "recruiting" },
  }),
  // ── 시작 전 ──
  note({
    key: "launchDay", noteId: "01KH000001028", title: "Launch day run of show", project: "launch", daysAgo: 0, hour: 11,
    status: "NOT_STARTED", people: ["seoyun", "sera", "jiho", "yuna"],
  }),
  note({
    key: "int4", noteId: "01KH000001029", title: "Prep for interview round 4", project: "interview", daysAgo: 1, hour: 10,
    status: "NOT_STARTED", people: ["seoyun"],
  }),
  note({
    key: "holiday", noteId: "01KH000001030", title: "Holiday coverage schedule", project: "weekly", daysAgo: 2, hour: 15,
    status: "NOT_STARTED", people: ["yuna", "jiho"],
  }),
];
