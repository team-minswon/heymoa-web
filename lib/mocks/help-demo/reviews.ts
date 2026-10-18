import type { SeedItem, SeedTopic } from "@/lib/mocks/fixtures/meeting-review-seed";
import { MID_FLOW, MID_MEETINGS } from "@/lib/mocks/help-demo/mid";
import { NOTE_DEFS, HD_NOTE_IDS } from "@/lib/mocks/help-demo/notes";
import { HD_MEMBERS } from "@/lib/mocks/help-demo/people";
import { anchorsOf } from "@/lib/mocks/help-demo/script";
import { CAMPAIGN_SCRIPT } from "@/lib/mocks/help-demo/script-campaign";
import { LANDING_SCRIPT } from "@/lib/mocks/help-demo/script-landing";
import { appDayMs } from "@/lib/mocks/help-demo/time";

/** 회의 하나의 검토본·요약 시드. `meeting-flow.ts` 가 멘토링 시드와 같은 틀로 푼다. */
export type HelpDemoReviewSet = {
  noteId: string;
  /** 회의 뒤 흐름 상태 */
  flow: "REVIEWABLE" | "CONFIRMED";
  headline: string;
  headlineTopics: number[];
  lead: Array<{ text: string; topics: number[] }>;
  topics: SeedTopic[];
  loose: SeedItem[];
  /** 기한을 세는 기준 날짜(회의 날, UTC 자정) */
  meetingDate: number;
};

const c = anchorsOf(CAMPAIGN_SCRIPT);
const l = anchorsOf(LANDING_SCRIPT);

/**
 * 핵심 회의 1. 결정 9 · 할 일 12 · 열린 질문 5(질문 3 + 이슈 2) · 참고 여럿.
 * 담당 `A`·`B` 는 참석자에 연결된 화자라 이름으로 풀리고, `C`·`D` 는 아직 연결 전이라 화자 라벨로 남는다.
 */
const campaignTopics: SeedTopic[] = [
  {
    title: "4월 전체 성과",
    hasAgenda: true,
    items: [
      { kind: "AGENDA", content: "4월 캠페인 전체 성과", at: c("opening", "spend") },
      { kind: "STATUS_REPORT", content: "광고비 4,800만 원으로 매출 1억 9,300만 원, ROAS 402%를 기록해 목표 380%를 넘겼다", at: c("roas", "revenue") },
      { kind: "STATUS_REPORT", content: "CTR 1.8%, 전환율 2.4%로 3월보다 모두 올랐다", at: c("ctr", "conversion") },
      { kind: "INSIGHT", content: "ROAS는 마지막 클릭 기준이라 소셜과 이메일의 기여가 낮게 잡힌다", at: c("roas") },
      { kind: "QUESTION", content: "신규 고객과 기존 고객 비중이 정확히 얼마인지", at: c("newcust") },
      { kind: "ACTION_ITEM", content: "신규 고객 비중의 정확한 수치를 오늘 안에 공유한다", at: c("newcust"), who: "A", dueIn: 0 },
    ],
    sentences: [
      { text: "4월 ROAS는 402%로 목표를 넘겼고 CTR과 전환율도 올랐다.", items: [1, 2] },
      { text: "신규 고객 비중은 정확한 수치를 오늘 안에 공유받는다.", items: [4, 5] },
    ],
  },
  {
    title: "채널별 효율과 5월 예산",
    hasAgenda: true,
    items: [
      { kind: "AGENDA", content: "채널별 비교와 5월 예산", at: c("channels") },
      { kind: "DECISION", content: "디스플레이는 5월에 600만 원에서 300만 원으로 줄인다", at: c("display-cut") },
      { kind: "DECISION", content: "5월 예산 5,000만 원은 검색 2,000 · 소셜 2,100 · 디스플레이 300 · 이메일 400 · 리타겟팅 200(만 원)으로 나눈다", at: c("budget-shift") },
      { kind: "DECISION", content: "소셜은 영상과 이미지 비율을 3 대 7로 바꿔 구매 전환 쪽에 더 싣는다", at: c("social-ratio") },
      { kind: "ACTION_ITEM", content: "브랜드 키워드와 일반 키워드를 나눈 검색 성과 표를 만든다", at: c("search-keyword"), who: "A", dueIn: 3 },
      { kind: "ACTION_ITEM", content: "디스플레이 지역 비교 테스트 설계안을 다음 주 회의 전까지 가져온다", at: c("holdout"), who: "A", dueIn: 6 },
      { kind: "ACTION_ITEM", content: "5월 예산안을 이번 주 금요일까지 위에 올린다", at: c("budget-confirm"), who: "B", dueIn: 3 },
      { kind: "ACTION_ITEM", content: "쿠폰이 있는 이메일과 없는 이메일을 나눠 발송한다", at: c("coupon"), who: `user:${HD_MEMBERS.yuna.userId}` as const, dueIn: 7 },
      { kind: "ISSUE", content: "브랜드 키워드를 빼면 검색 효율이 소셜과 비슷한 수준이다", at: c("search-keyword") },
      { kind: "STATUS_REPORT", content: "채널별 ROAS는 이메일 780%, 검색 520%, 소셜 310%, 디스플레이 180%다", at: c("channel-roas") },
      { kind: "INSIGHT", content: "영상은 클릭이, 이미지는 구매 전환이 더 높아 역할을 나눌 수 있다", at: c("video-image") },
      { kind: "INSIGHT", content: "이메일 ROAS는 쿠폰 메일 덕분에 높게 나왔을 수 있다", at: c("coupon") },
    ],
    sentences: [
      { text: "디스플레이를 줄이고 검색 · 이메일 · 리타겟팅으로 옮겨 5월 예산을 나눴다.", items: [1, 2] },
      { text: "소셜은 유지하되 영상과 이미지 비율을 바꾸고, 지역 비교 테스트를 설계한다.", items: [3, 5] },
    ],
  },
  {
    title: "소재 테스트와 리타겟팅",
    hasAgenda: true,
    items: [
      { kind: "AGENDA", content: "소재 A/B 결과와 퍼널", at: c("abtest") },
      { kind: "DECISION", content: "리타겟팅 광고를 오늘부터 소재 B로 바꾼다", at: c("retarget-switch") },
      { kind: "DECISION", content: "리타겟팅 14일 윈도우를 리타겟팅 예산의 30%로 테스트한다", at: c("retarget-test") },
      { kind: "DECISION", content: "후기 소재는 사용 동의를 받은 일곱 건으로 변형 세 종을 만든다", at: c("creative-three") },
      { kind: "ACTION_ITEM", content: "후기 소재 변형 세 종 시안을 5월 둘째 주까지 만든다", at: c("creative-three"), who: "C", dueIn: 14 },
      { kind: "ACTION_ITEM", content: "리타겟팅을 소재 B로 바꾸고 14일 윈도우 테스트를 설정한다", at: c("retarget-switch", "retarget-test"), who: "A", dueIn: 0 },
      { kind: "ACTION_ITEM", content: "후기 소재 문구에 효능을 단정하는 표현이 없는지 확인한다", at: c("legal-check"), who: "B", dueIn: 14 },
      { kind: "ACTION_ITEM", content: "결제 수단 추가 요청을 개발팀 이슈로 올린다", at: c("checkout-drop"), who: "B", dueIn: 2 },
      { kind: "ISSUE", content: "결제를 시작한 뒤 완료까지 4명 중 1명 넘게 빠진다", at: c("checkout-drop") },
      { kind: "STATUS_REPORT", content: "소재 B가 CTR 2.3%(A 1.5%), 전환율 2.9%(A 2.1%)로 앞섰다", at: c("abtest-result") },
      { kind: "STATUS_REPORT", content: "퍼널 전환은 상세에서 장바구니 38%, 결제 시작 61%, 완료 72%다", at: c("funnel") },
      { kind: "STATUS_REPORT", content: "후기 소재 사용 동의는 열두 건 중 일곱 건에서 받았다", at: c("review-consent") },
    ],
    sentences: [
      { text: "소재 B가 이겨 리타겟팅을 바로 B로 바꾸고 변형 세 종을 만든다.", items: [1, 3] },
      { text: "결제 단계 이탈은 개발팀 이슈로 올린다.", items: [7, 8] },
    ],
  },
  {
    title: "5월 목표와 보고 방식",
    hasAgenda: true,
    items: [
      { kind: "AGENDA", content: "5월 목표와 보고 방식", at: c("okr") },
      { kind: "DECISION", content: "5월 ROAS 목표는 450%로 한다", at: c("okr") },
      { kind: "DECISION", content: "신규 고객 비중 45%를 두 번째 핵심 결과로 하고 전환율 2.6%는 보조 지표로 둔다", at: c("kr-newcust") },
      { kind: "DECISION", content: "성과 보고는 매주 월요일 한 장으로, 소진율 · ROAS · 전환율 · 신규 비중만 본다", at: c("weekly-report") },
      { kind: "ACTION_ITEM", content: "KPI 문서를 이번 주 안에 업데이트한다", at: c("kr-newcust"), who: "me", dueIn: 4 },
      { kind: "ACTION_ITEM", content: "주간 성과 한 장 리포트를 다음 주 월요일부터 올린다", at: c("weekly-start"), who: "me", dueIn: 5 },
      { kind: "ACTION_ITEM", content: "소셜 광고를 본 뒤 검색으로 구매한 비율을 추정해 본다", at: c("attribution"), who: "A", dueIn: 6 },
      { kind: "QUESTION", content: "연휴 기간의 목표를 평균과 다르게 볼지", at: c("holiday") },
      { kind: "QUESTION", content: "4월 신규 고객의 30일 재구매율은 얼마인지", at: c("repurchase") },
      { kind: "STATUS_REPORT", content: "작년 5월 연휴에는 클릭은 늘고 전환율은 0.5%포인트 떨어졌다", at: c("holiday") },
    ],
    sentences: [
      { text: "5월 ROAS 450%와 신규 고객 비중 45%를 목표로 정했다.", items: [1, 2] },
      { text: "성과는 매주 한 장으로 보고, 연휴 목표와 재구매율은 열린 질문으로 남았다.", items: [3, 7, 8] },
    ],
  },
];

const landingTopics: SeedTopic[] = [
  {
    title: "제목과 혜택 문구",
    hasAgenda: true,
    items: [
      { kind: "AGENDA", content: "제목과 혜택 문구", at: l("opening") },
      { kind: "DECISION", content: "제목은 「가볍게 스며드는 수분 크림」으로 하고 부제는 성적서를 확인한 뒤 정한다", at: l("title-decision") },
      { kind: "DECISION", content: "혜택은 가벼운 수분, 향이 거의 없는 사용감, 민감한 피부도 편안하게 세 가지로 한다", at: l("benefits-decision") },
      { kind: "DECISION", content: "「무향」이라고 쓰지 않고 「향이 거의 없다」까지만 쓴다", at: l("no-fragrance") },
      { kind: "ACTION_ITEM", content: "시험 성적서가 있는지 확인해 부제에 숫자를 넣을지 정한다", at: l("report-check"), who: "A", dueIn: 0 },
      { kind: "QUESTION", content: "부제에 「열두 시간」 같은 숫자를 쓸 수 있는지", at: l("title-options") },
      { kind: "ISSUE", content: "「민감한 피부」 표현은 시험 결과나 법무 검토가 필요하다", at: l("legal-review") },
    ],
    sentences: [
      { text: "제목과 혜택 세 가지를 정했고, 부제의 숫자는 성적서를 확인한 뒤 넣는다.", items: [1, 2] },
      { text: "「향이 거의 없다」까지만 쓰고 「무향」은 쓰지 않는다.", items: [3] },
    ],
  },
  {
    title: "성분 · 후기 · 신청",
    hasAgenda: true,
    items: [
      { kind: "AGENDA", content: "성분, 후기, 신청 버튼", at: l("ingredient-copy") },
      { kind: "DECISION", content: "성분은 이름 옆에 쉬운 한 줄 설명을 붙인다", at: l("ingredient-copy") },
      { kind: "DECISION", content: "후기는 네 개로 하고 별점 평균은 넣지 않는다", at: l("review-source") },
      { kind: "DECISION", content: "신청 버튼은 「출시 알림 신청하기」로 하고 아래에 안내 한 줄을 넣는다", at: l("cta-decision") },
      { kind: "DECISION", content: "출시 알림은 이메일로만 보내고 신청 폼은 이메일과 동의 두 가지만 받는다", at: l("email-only") },
      { kind: "ACTION_ITEM", content: "성분별 한 줄 설명을 정리해 보낸다", at: l("ingredient-copy"), who: "B", dueIn: 0 },
      { kind: "ACTION_ITEM", content: "동의를 받은 후기 중 톤이 다른 두 개를 골라 후기를 네 개로 만든다", at: l("review-pick"), who: "C", dueIn: 4 },
      { kind: "ACTION_ITEM", content: "개인정보 수집 동의 표준 문구를 시안에 넣는다", at: l("email-only"), who: "C", dueIn: 4 },
      { kind: "STATUS_REPORT", content: "후기 영역에는 「베타 테스터 후기」 출처를 작게 적는다", at: l("review-source") },
    ],
    sentences: [
      { text: "성분 설명, 후기 네 개, 신청 버튼 문구를 정했다.", items: [1, 2, 3] },
      { text: "알림은 이메일로만 보내고 폼은 최소한으로 받는다.", items: [4] },
    ],
  },
  {
    title: "일정과 남은 질문",
    hasAgenda: true,
    items: [
      { kind: "AGENDA", content: "일정", at: l("deadline") },
      { kind: "DECISION", content: "문구 최종본은 금요일, 개발팀 전달은 월요일, 최종 디자인은 수요일에 한다", at: l("deadline") },
      { kind: "DECISION", content: "이미지 위 문구는 「새로 나왔어요」로 한다", at: l("hero-label") },
      { kind: "ACTION_ITEM", content: "문구 최종본을 금요일까지 정리한다", at: l("deadline"), who: "B", dueIn: 2 },
      { kind: "ACTION_ITEM", content: "최종 문구를 법무 검토에 요청하고 월요일 오전까지 회신을 받는다", at: l("legal-review", "deadline"), who: "C", dueIn: 5 },
      { kind: "ACTION_ITEM", content: "최종 디자인을 다음 주 수요일에 전달한다", at: l("deadline"), who: "B", dueIn: 7 },
      { kind: "QUESTION", content: "출시일과 가격이 정해지면 FAQ를 어떻게 채울지", at: l("faq-hold") },
    ],
    sentences: [
      { text: "문구는 금요일에 확정하고 월요일에 개발팀에 넘긴다.", items: [1, 3, 4] },
      { text: "FAQ는 출시일과 가격이 정해진 뒤 채운다.", items: [6] },
    ],
  },
];

const dateOf = (noteId: string) => {
  const def = NOTE_DEFS.find((row) => row.noteId === noteId);
  if (!def) throw new Error(`help-demo 없는 회의: ${noteId}`);
  return appDayMs(def.daysAgo);
};

/** 모든 검토본 시드. 핵심 회의 둘과 중간 길이 회의 여덟 개. */
export function helpDemoReviewSets(): HelpDemoReviewSet[] {
  const mids = NOTE_DEFS.flatMap((def) =>
    def.source?.kind === "mid" ? [{ def, key: def.source.id }] : []
  ).map(({ def, key }): HelpDemoReviewSet => {
    const meeting = MID_MEETINGS[key];
    return {
      noteId: def.noteId,
      flow: MID_FLOW[key],
      headline: meeting.headline,
      headlineTopics: [1],
      lead: meeting.lead,
      topics: meeting.topics,
      loose: [],
      meetingDate: dateOf(def.noteId),
    };
  });
  return [
    {
      noteId: HD_NOTE_IDS.campaign,
      flow: "REVIEWABLE",
      headline: "4월 ROAS는 목표를 넘겼고, 5월에는 디스플레이를 줄여 검색 · 이메일 · 리타겟팅으로 옮긴다",
      headlineTopics: [1, 2],
      lead: [
        { text: "4월 ROAS 402%로 목표 380%를 넘겼다. 디스플레이 효율이 가장 낮아 5월에 절반으로 줄인다.", topics: [1, 2] },
        { text: "리타겟팅은 소재 B로 바꾸고, 5월 목표는 ROAS 450%와 신규 고객 비중 45%로 정했다.", topics: [3, 4] },
      ],
      topics: campaignTopics,
      loose: [{ kind: "STATUS_REPORT", content: "회의록은 김서윤이 정리한다", at: c("opening") }],
      meetingDate: dateOf(HD_NOTE_IDS.campaign),
    },
    {
      noteId: HD_NOTE_IDS.landing,
      flow: "CONFIRMED",
      headline: "신제품 소개 페이지 문구를 확정해 월요일에 개발팀에 넘긴다",
      headlineTopics: [1, 2],
      lead: [
        { text: "제목은 「가볍게 스며드는 수분 크림」, 신청 버튼은 「출시 알림 신청하기」로 정했다.", topics: [1, 2] },
        { text: "법무 검토를 거쳐 월요일에 문구를 넘기고, FAQ는 출시일과 가격이 정해진 뒤 채운다.", topics: [3] },
      ],
      topics: landingTopics,
      loose: [],
      meetingDate: dateOf(HD_NOTE_IDS.landing),
    },
    ...mids,
  ];
}

/** 아직 검토본이 없는 회의를 방금 끝냈을 때 목이 만들어 내는 항목(`completeAnalysis`). 내용은 일반 업무 대화다. */
export const HELP_DEMO_ENDED_ITEMS: SeedItem[] = [
  { kind: "AGENDA", content: "쿠폰 지급 기준과 문의 분류 규칙", at: [0] },
  { kind: "DECISION", content: "사흘 이상 지연된 주문에만 5,000원 쿠폰을 드린다", at: [0] },
  { kind: "DECISION", content: "교환 · 환불 키워드가 있으면 우선으로 분류한다", at: [0] },
  { kind: "ACTION_ITEM", content: "쿠폰 안내 문자를 오늘 오후 세 시 전에 보낸다", at: [0], who: "me", dueIn: 0 },
  { kind: "ACTION_ITEM", content: "문의 분류 규칙을 이번 주 안에 고친다", at: [0], dueIn: 4 },
  { kind: "QUESTION", content: "품절 상품 여섯 개의 입고 일정은 언제 확인되는지", at: [0] },
];
