import type { SeedItem, SeedTopic } from "@/lib/mocks/fixtures/meeting-review-seed";
import { MID_FLOW, MID_MEETINGS } from "@/lib/mocks/help-demo/en/mid";
import { NOTE_DEFS, HD_NOTE_IDS } from "@/lib/mocks/help-demo/en/notes";
import { HD_MEMBERS } from "@/lib/mocks/help-demo/en/people";
import { anchorsOf } from "@/lib/mocks/help-demo/script";
import { CAMPAIGN_SCRIPT } from "@/lib/mocks/help-demo/en/script-campaign";
import { LANDING_SCRIPT } from "@/lib/mocks/help-demo/en/script-landing";
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
    title: "April results overall",
    hasAgenda: true,
    items: [
      { kind: "AGENDA", content: "April campaign results overall", at: c("opening", "spend") },
      { kind: "STATUS_REPORT", content: "$48,000 in ad spend drove $193,000 in revenue, a 402% ROAS that beat the 380% target", at: c("roas", "revenue") },
      { kind: "STATUS_REPORT", content: "CTR (1.8%) and conversion rate (2.4%) both rose from March", at: c("ctr", "conversion") },
      { kind: "INSIGHT", content: "ROAS is last-click, so it undercounts social and email", at: c("roas") },
      { kind: "QUESTION", content: "What is the exact split between new and returning customers?", at: c("newcust") },
      { kind: "ACTION_ITEM", content: "Share the exact new customer share today", at: c("newcust"), who: "A", dueIn: 0 },
    ],
    sentences: [
      { text: "April ROAS hit 402%, beating target, and CTR and conversion rate both rose.", items: [1, 2] },
      { text: "The exact new customer share will be shared today.", items: [4, 5] },
    ],
  },
  {
    title: "Channel efficiency and May budget",
    hasAgenda: true,
    items: [
      { kind: "AGENDA", content: "Channel comparison and May budget", at: c("channels") },
      { kind: "DECISION", content: "Cut display from $6,000 to $3,000 in May", at: c("display-cut") },
      { kind: "DECISION", content: "Split the $50,000 May budget: search $20K, social $21K, display $3K, email $4K, retargeting $2K", at: c("budget-shift") },
      { kind: "DECISION", content: "Shift social to a 30/70 video-to-image split to favor conversions", at: c("social-ratio") },
      { kind: "ACTION_ITEM", content: "Build a search results table split by brand and generic keywords", at: c("search-keyword"), who: "A", dueIn: 3 },
      { kind: "ACTION_ITEM", content: "Bring a display holdout test design before next week's meeting", at: c("holdout"), who: "A", dueIn: 6 },
      { kind: "ACTION_ITEM", content: "Send the May budget to leadership by this Friday", at: c("budget-confirm"), who: "B", dueIn: 3 },
      { kind: "ACTION_ITEM", content: "Split email sends into with-coupon and no-coupon groups", at: c("coupon"), who: `user:${HD_MEMBERS.yuna.userId}` as const, dueIn: 7 },
      { kind: "ISSUE", content: "Without brand keywords, search is about as efficient as social", at: c("search-keyword") },
      { kind: "STATUS_REPORT", content: "ROAS by channel: email 780%, search 520%, social 310%, display 180%", at: c("channel-roas") },
      { kind: "INSIGHT", content: "Video drives more clicks and images drive more purchases, so they can play different roles", at: c("video-image") },
      { kind: "INSIGHT", content: "Email ROAS may be inflated by the coupon email", at: c("coupon") },
    ],
    sentences: [
      { text: "The May budget moves money out of display into search, email, and retargeting.", items: [1, 2] },
      { text: "Social stays flat with a new video-to-image split, and a holdout test is being designed.", items: [3, 5] },
    ],
  },
  {
    title: "Creative test and retargeting",
    hasAgenda: true,
    items: [
      { kind: "AGENDA", content: "Creative A/B results and funnel", at: c("abtest") },
      { kind: "DECISION", content: "Switch retargeting ads to creative B starting today", at: c("retarget-switch") },
      { kind: "DECISION", content: "Test a 14-day retargeting window with 30% of the retargeting budget", at: c("retarget-test") },
      { kind: "DECISION", content: "Make three review creative variations from the seven reviews with consent", at: c("creative-three") },
      { kind: "ACTION_ITEM", content: "Draft three review creative variations by the second week of May", at: c("creative-three"), who: "C", dueIn: 14 },
      { kind: "ACTION_ITEM", content: "Switch retargeting to creative B and set up the 14-day window test", at: c("retarget-switch", "retarget-test"), who: "A", dueIn: 0 },
      { kind: "ACTION_ITEM", content: "Check that review creative copy makes no definitive claims about results", at: c("legal-check"), who: "B", dueIn: 14 },
      { kind: "ACTION_ITEM", content: "File a request with the dev team to add a payment method", at: c("checkout-drop"), who: "B", dueIn: 2 },
      { kind: "ISSUE", content: "More than one in four shoppers drop off between starting checkout and purchase", at: c("checkout-drop") },
      { kind: "STATUS_REPORT", content: "Creative B won on CTR (2.3% vs. 1.5%) and conversion rate (2.9% vs. 2.1%)", at: c("abtest-result") },
      { kind: "STATUS_REPORT", content: "Funnel: 38% product page to cart, 61% to checkout start, 72% to purchase", at: c("funnel") },
      { kind: "STATUS_REPORT", content: "Seven of twelve reviewers gave consent for use in ads", at: c("review-consent") },
    ],
    sentences: [
      { text: "Creative B won, so retargeting switches to B now and three variations are coming.", items: [1, 3] },
      { text: "Checkout drop-off goes to the dev team as an issue.", items: [7, 8] },
    ],
  },
  {
    title: "May targets and reporting",
    hasAgenda: true,
    items: [
      { kind: "AGENDA", content: "May targets and reporting", at: c("okr") },
      { kind: "DECISION", content: "Set the May ROAS target at 450%", at: c("okr") },
      { kind: "DECISION", content: "Make 45% new customer share the second key result, with 2.6% conversion rate as a supporting metric", at: c("kr-newcust") },
      { kind: "DECISION", content: "Report results on a one-pager every Monday covering only pacing, ROAS, conversion rate, and new customer share", at: c("weekly-report") },
      { kind: "ACTION_ITEM", content: "Update the KPI doc this week", at: c("kr-newcust"), who: "me", dueIn: 4 },
      { kind: "ACTION_ITEM", content: "Post the weekly one-page report starting next Monday", at: c("weekly-start"), who: "me", dueIn: 5 },
      { kind: "ACTION_ITEM", content: "Estimate how many people bought through search after seeing a social ad", at: c("attribution"), who: "A", dueIn: 6 },
      { kind: "QUESTION", content: "Should holiday periods have different targets from the average?", at: c("holiday") },
      { kind: "QUESTION", content: "What is the 30-day repeat purchase rate for April's new customers?", at: c("repurchase") },
      { kind: "STATUS_REPORT", content: "Over last year's May holidays, clicks rose and conversion rate fell 0.5 points", at: c("holiday") },
    ],
    sentences: [
      { text: "May targets are 450% ROAS and 45% new customer share.", items: [1, 2] },
      { text: "Results will go out as a weekly one-pager. Holiday targets and repeat purchase rate are still open questions.", items: [3, 7, 8] },
    ],
  },
];

const landingTopics: SeedTopic[] = [
  {
    title: "Headline and benefits copy",
    hasAgenda: true,
    items: [
      { kind: "AGENDA", content: "Headline and benefits copy", at: l("opening") },
      { kind: "DECISION", content: "Use \"A lightweight moisturizer that sinks right in\" as the headline and set the subhead after checking the lab report", at: l("title-decision") },
      { kind: "DECISION", content: "The three benefits are lightweight hydration, a nearly fragrance-free feel, and gentle on sensitive skin", at: l("benefits-decision") },
      { kind: "DECISION", content: "Say \"nearly fragrance-free\" and never \"unscented\"", at: l("no-fragrance") },
      { kind: "ACTION_ITEM", content: "Check for a lab report and decide whether the subhead gets a number", at: l("report-check"), who: "A", dueIn: 0 },
      { kind: "QUESTION", content: "Can the subhead use a number like \"12 hours\"?", at: l("title-options") },
      { kind: "ISSUE", content: "The \"sensitive skin\" wording needs test results or legal review", at: l("legal-review") },
    ],
    sentences: [
      { text: "The headline and three benefits are set. The subhead number waits on the lab report.", items: [1, 2] },
      { text: "The copy says \"nearly fragrance-free\" and never \"unscented.\"", items: [3] },
    ],
  },
  {
    title: "Ingredients, reviews, sign-up",
    hasAgenda: true,
    items: [
      { kind: "AGENDA", content: "Ingredients, reviews, and sign-up button", at: l("ingredient-copy") },
      { kind: "DECISION", content: "Each ingredient gets a plain one-line description next to its name", at: l("ingredient-copy") },
      { kind: "DECISION", content: "Show four reviews and no average star rating", at: l("review-source") },
      { kind: "DECISION", content: "The sign-up button says \"Notify me at launch\" with one line of explanation below", at: l("cta-decision") },
      { kind: "DECISION", content: "Send launch alerts by email only, and the form asks only for email and consent", at: l("email-only") },
      { kind: "ACTION_ITEM", content: "Write and send the one-line ingredient descriptions", at: l("ingredient-copy"), who: "B", dueIn: 0 },
      { kind: "ACTION_ITEM", content: "Pick two more consented reviews with a different tone to make four", at: l("review-pick"), who: "C", dueIn: 4 },
      { kind: "ACTION_ITEM", content: "Add the standard privacy consent wording to the draft", at: l("email-only"), who: "C", dueIn: 4 },
      { kind: "STATUS_REPORT", content: "The reviews section carries a small \"Beta tester reviews\" source line", at: l("review-source") },
    ],
    sentences: [
      { text: "Ingredient descriptions, four reviews, and the button copy are set.", items: [1, 2, 3] },
      { text: "Alerts go by email only, and the form stays minimal.", items: [4] },
    ],
  },
  {
    title: "Timeline and open questions",
    hasAgenda: true,
    items: [
      { kind: "AGENDA", content: "Timeline", at: l("deadline") },
      { kind: "DECISION", content: "Final copy Friday, handoff to dev Monday, final design Wednesday", at: l("deadline") },
      { kind: "DECISION", content: "The hero image label is \"Just launched\"", at: l("hero-label") },
      { kind: "ACTION_ITEM", content: "Finish the final copy by Friday", at: l("deadline"), who: "B", dueIn: 2 },
      { kind: "ACTION_ITEM", content: "Send the final copy to legal and get a reply by Monday morning", at: l("legal-review", "deadline"), who: "C", dueIn: 5 },
      { kind: "ACTION_ITEM", content: "Deliver the final design next Wednesday", at: l("deadline"), who: "B", dueIn: 7 },
      { kind: "QUESTION", content: "How should the FAQ be filled in once the launch date and price are set?", at: l("faq-hold") },
    ],
    sentences: [
      { text: "Copy is locked Friday and goes to dev Monday.", items: [1, 3, 4] },
      { text: "The FAQ gets filled in once the launch date and price are set.", items: [6] },
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
      headline: "April ROAS beat target, and May moves display budget into search, email, and retargeting",
      headlineTopics: [1, 2],
      lead: [
        { text: "April ROAS hit 402%, beating the 380% target. Display was the least efficient, so it gets cut in half for May.", topics: [1, 2] },
        { text: "Retargeting switches to creative B, and May targets are 450% ROAS and 45% new customer share.", topics: [3, 4] },
      ],
      topics: campaignTopics,
      loose: [{ kind: "STATUS_REPORT", content: "Emma Carter is taking the meeting notes", at: c("opening") }],
      meetingDate: dateOf(HD_NOTE_IDS.campaign),
    },
    {
      noteId: HD_NOTE_IDS.landing,
      flow: "CONFIRMED",
      headline: "Landing page copy for the new product is locked and goes to dev on Monday",
      headlineTopics: [1, 2],
      lead: [
        { text: "The headline is \"A lightweight moisturizer that sinks right in\" and the button is \"Notify me at launch.\"", topics: [1, 2] },
        { text: "Copy goes to dev Monday after legal review. The FAQ waits until the launch date and price are set.", topics: [3] },
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
  { kind: "AGENDA", content: "Coupon rules and ticket routing", at: [0] },
  { kind: "DECISION", content: "Give a $5 coupon only on orders delayed three days or more", at: [0] },
  { kind: "DECISION", content: "Route tickets with exchange or refund keywords first", at: [0] },
  { kind: "ACTION_ITEM", content: "Send the coupon text before 3 p.m. today", at: [0], who: "me", dueIn: 0 },
  { kind: "ACTION_ITEM", content: "Fix the ticket routing rules this week", at: [0], dueIn: 4 },
  { kind: "QUESTION", content: "When will we know the restock dates for the six sold-out products?", at: [0] },
];
