import type { SeedTopic } from "@/lib/mocks/fixtures/meeting-review-seed";
import { anchorsOf, parseScript } from "@/lib/mocks/help-demo/script";

/** 중간 길이 회의의 전사와 요약 시드. 요약은 주제 하나, 결정 2~4개, 할 일 2~5개로 작게 둔다. */
export type MidMeeting = {
  script: ReturnType<typeof parseScript>;
  headline: string;
  lead: Array<{ text: string; topics: number[] }>;
  topics: SeedTopic[];
};

/** 봄 캠페인 키비주얼 시안 검토. 화자 A 이하린, B 최민재, C 박도윤. */
const visualScript = parseScript(`
A So we've got three key visual drafts. The goal today is to narrow it down to one. Marcus, can you walk us through the idea behind each?
B Sure. Option 1 is mostly a shot of drifting petals. Option 2 puts the product big in the center on a soft green background. Option 3 is someone holding the product.
A We haven't booked a model for option 3 yet. Is that doable?
B This draft uses a placeholder photo. If we pick it, we'd need to schedule a separate shoot.
C From the ads side, option 2 is the safest. The product is big, so you can tell what it is even in a small thumbnail.
C Option 1 is pretty, but in a mobile feed the product is way too small.
A Same here. Option 1 has a nice mood, but you can't see the product. What do you think of option 3?
C Creative with people in it often gets a better CTR. But the shoot costs extra, so it's a stretch this time.
B I'd estimate around $2,500. That's a half-day shoot with one model.
A That's not in this budget. Let's drop option 3 for this campaign and keep it as a candidate for the next one. @drop-three
B Got it. So it's between option 1 and option 2.
C I'd go with option 2 but borrow the petal feel from option 1. A totally static background doesn't feel much like spring.
B I can scatter a few faint petals over the option 2 background. As long as they don't cover the product.
A Let's do that. Option 2 as the base, with a light layer of petals. @pick-two
A What about the color? Is the soft green too cold?
B If I add a hint of yellow to the green, it warms up. I'll make two color versions so we can compare.
C We could test the colors once the ads are running. We'd be using both versions anyway.
A Good. Then please produce both color versions. @color-two
B What about the copy? Right now it says "Spring is here."
A That's too generic. I'd like at least one line about the product.
C If the copy runs long, it gets cut off on mobile. It needs to stay under 25 characters.
B "Spring sinks right in" is 21 characters, so that should work.
A I like it. Put that line in the draft. @copy-line
B Will do. We need different sizes too, right? Square and vertical?
C Yes, square and vertical are a must, and horizontal if you can.
B The timeline's tight for horizontal, so I'll send the first two to start.
A When can you have them done?
B I'll deliver the final files next Tuesday. @deadline
C If we get them then, we can have them in ads starting Wednesday.
A One thing I'm worried about is ad review. If the petals look like they're hiding the product, could that be a problem?
C Ad review usually flags copy, not images. I'll still double-check. @ask-review
A Thanks, please do. That's it for today. Nice work, everyone.
`);
const v = anchorsOf(visualScript);

export const VISUAL_MEETING: MidMeeting = {
  script: visualScript,
  headline: "Key visual goes with option 2, which shows the product large",
  lead: [
    {
      text: "Option 2 gets a light layer of petals and comes in two color versions. Option 3 needs a model shoot, so it moves to the next campaign.",
      topics: [1],
    },
  ],
  topics: [
    {
      title: "Choosing the key visual",
      hasAgenda: false,
      items: [
        { kind: "DECISION", content: "Use option 2 as the base key visual, with a light layer of petals", at: v("pick-two") },
        { kind: "DECISION", content: "Drop option 3 from this campaign because of the shoot cost and keep it for the next one", at: v("drop-three") },
        { kind: "DECISION", content: "Use \"Spring sinks right in\" as the copy line in the draft", at: v("copy-line") },
        { kind: "ACTION_ITEM", content: "Produce the draft in two color versions", at: v("color-two"), who: "B", dueIn: 5 },
        { kind: "ACTION_ITEM", content: "Deliver the final files in square and vertical formats", at: v("deadline"), who: "B", dueIn: 6 },
        { kind: "ACTION_ITEM", content: "Check whether the image could cause problems in ad review", at: v("ask-review"), who: "C" },
      ],
      sentences: [
        { text: "Option 2 gets petals, and option 3 moves to the next campaign.", items: [0, 1] },
        { text: "Two color versions will be delivered next Tuesday.", items: [3, 4] },
      ],
    },
  ],
};

/** 광고 소재 A/B 테스트 설계. 화자 A 박도윤, B 최민재, C 이하린. */
const abScript = parseScript(`
A This meeting is to decide how we design the May creative A/B test. In April we just ran creative A and B side by side, but this time we want to change one variable at a time.
C Good. In April the two creatives differed in a bunch of ways, so we never really knew why one won.
A Right. We couldn't tell if it was the review or the different color. So step one this time is a test that only changes whether there's a review. @one-variable
B So I make two versions of the same image, one with the review quote and one without?
A Yes. Image, color, and button copy stay exactly the same.
C And we split impressions evenly? Same audience, same time slots?
A Exactly. We'll turn off the platform's auto-optimization and run an even split. If you leave it on auto, it pushes everything to one side. @even-split
C How long do we run it?
A At least two weeks, so day-of-week effects wash out. Once each side gets 30,000 clicks or more, we can call it.
B What does 30,000 clicks cost?
A At an average CPC of $0.21, that's about $6,300 per side, so roughly $12,600 for both.
C That's not bad. We can run it inside the May social budget.
A Yeah, no new budget. We'll run it out of the existing social budget. @budget-inside
B What's the success metric? If we only look at CTR, we could get lots of clicks and no sales.
A Conversion rate is the primary metric, with CTR and ROAS as secondary. We only call a winner if there's a significant difference in conversion rate. @metric
C What counts as significant?
A We'll use a 95% confidence level. I'll set up a calculator in the sheet.
B What's the second test? If this one wins, we change something else on top of it?
A Yes. If the review wins, the second test would be a photo review versus text only. We'll decide after we see the first results.
C What if the results come out about the same?
A If there's no difference, we go with the simpler one. The version without a review is easier to produce. @tie-rule
C Makes sense. Please put that rule in the doc too.
A Will do. And how should we share the results?
C When the test's done, put it on one page and show it in a meeting. Just the numbers and the conclusion.
A Got it. The test starts next Monday. @start
B I'll make the two creatives this week. One with the review, one without.
C We can't peek at results halfway through, right? I'll be curious after a week.
A You can check, but don't make a call from it. At the one-week mark, let's only check click counts.
C Good rule. People make that mistake a lot, ending early because one side is ahead.
A Right. I'll write it in the doc as a rule. No conclusions before two weeks.
B The ad copy should be the same length on both, right? The review version gets longer.
A Adding a review does change the length. Let's keep the headline and button copy identical and just add one review line.
B Got it. I'll keep the review line under 40 characters.
A Thanks. I'll set it up and get it started.
`);
const a = anchorsOf(abScript);

export const AB_MEETING: MidMeeting = {
  script: abScript,
  headline: "The May creative test changes only the review and runs for two weeks",
  lead: [
    {
      text: "We cut it to one variable, whether there's a review, and run an even split for two weeks. Conversion rate is the primary metric.",
      topics: [1],
    },
  ],
  topics: [
    {
      title: "A/B test design",
      hasAgenda: false,
      items: [
        { kind: "DECISION", content: "The first test changes only whether there's a review", at: a("one-variable") },
        { kind: "DECISION", content: "Split impressions evenly and run for at least two weeks", at: a("even-split") },
        { kind: "DECISION", content: "Conversion rate is the primary metric, at a 95% confidence level", at: a("metric") },
        { kind: "DECISION", content: "If there's no difference, go with the no-review version, which is easier to produce", at: a("tie-rule") },
        { kind: "ACTION_ITEM", content: "Create creatives with and without a review", at: a("start"), who: "B", dueIn: 4 },
        { kind: "ACTION_ITEM", content: "Set up an even split and start the test", at: a("start"), who: "A", dueIn: 6 },
        { kind: "QUESTION", content: "If the review wins, should the second test compare photo vs. no photo?", at: a("budget-inside") },
      ],
      sentences: [
        { text: "We cut it to one variable and will run an even split for two weeks.", items: [0, 1] },
        { text: "Conversion rate is the primary metric, and a tie goes to the simpler version.", items: [2, 3] },
      ],
    },
  ],
};
