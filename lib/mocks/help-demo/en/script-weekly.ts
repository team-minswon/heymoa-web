import { parseScript } from "@/lib/mocks/help-demo/script";

/**
 * 핵심 회의 3 「주간 운영 점검」의 앞부분. 아직 진행 중이라 화자 분리 전이다 — 화자 라벨은 쓰지 않고
 * 라벨 칸은 문법상 자리만 채운다(`speakerLabel` 은 null 로 심는다).
 */
export const WEEKLY_SCRIPT = parseScript(`
A Looks like everyone's here. Let's start this week's ops check-in.
A Today we'll go over three things: support tickets, late deliveries, and low-stock products.
B Sure. Starting with tickets, we got 312 this week. That's up 14% from last week.
B Shipping questions were the biggest at 118, then exchanges and refunds at 76, and how-to questions at 52.
C I think the how-to questions went up because of the new cream. A lot of people asked what order to use it in.
A Then we should add a how-to section to the product page.
C Yeah, one photo and about three lines would do it. I'll draft the copy.
B Average first response time went from 41 minutes last week to 58 this week. Our target is 30, so we're way off.
A Is it staffing, or a problem with how tickets get sorted?
B Both. One person was out Wednesday afternoon, and twelve tickets got sorted wrong and had to be reassigned.
A Let's look at the routing rules again. Can you tell which keywords tripped it up?
B Mostly exchange requests that mentioned shipping got sent to the shipping team.
A That sounds like a rule fix. Please change it this week.
B Got it. I'll make exchange and refund keywords take priority.
A And we need to plan for having no backup when someone's out. Let's cover that in the next item.
C Let me cover late deliveries too. We had 23 reports this week, and 17 of them were on the same carrier route.
A If it's the same route, it's probably on their end. Did you contact the carrier?
C I reached out Monday and heard back Tuesday. They said volume spiked and sorting fell behind.
A Have customers been notified?
C The delay texts went out, but the make-good coupons haven't. We need to set a rule first.
A Let's give a small coupon only to people delayed three days or more.
`);

/**
 * 녹음을 이어 하면 목 전사 시나리오가 이 문장들을 차례로 흘린다(`transcription-scenario.ts`).
 * 새로 시작하는 회의에서 녹음을 켰을 때 흘러나오는 대화 — 성과 확인, 예산 재배분, 담당과 일정 정리(가이드 시연용).
 * 어절 단위로 나뉘어 partial 로 먼저 보이므로 한 문장은 7어절 이상으로 둔다.
 */
export const HELP_DEMO_LIVE_SCRIPT = [
  "Okay, let's get started. Today we'll check April campaign results first and then set next month's budget.",
  "By channel, search ads have the highest conversion rate and display dropped off a lot.",
  "Let's talk about cutting some of the display budget and moving it to search and email.",
  "Olivia, please put the reallocation in a table and share it by this Friday.",
  "I'd also like to see the creative test results. When will the report draft be ready?",
  "The draft will be ready by Wednesday afternoon, and the final goes to Friday's meeting.",
  "Then let's compare two versions of the landing page copy.",
  "We'll pick this back up next Monday at the same time.",
] as const;
