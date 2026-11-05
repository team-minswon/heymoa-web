import { parseScript } from "@/lib/mocks/help-demo/script";

/**
 * 짧은 종료 회의의 대사. 목록과 회의 화면의 밀도를 채우는 것이 목적이라 8줄 안팎으로 둔다.
 * 키는 `notes.ts` 의 회의 열쇠와 같다.
 */
export const SMALL_SCRIPTS = {
  influencer: parseScript(`
A Let's line up the influencer collab schedule first. Four creators total, and shoots start next week.
B Two have confirmed dates already. We're still waiting to hear back from the other two.
A For the ones running late, let's wait until Friday. If we don't hear back, we move to the backups.
B I've got two backups ready. Similar follower counts, a bit of a different vibe.
A I'll ship product to the two confirmed creators first, tomorrow.
C Posts should go up the first week of May, right? So it lines up with the ad creative swap.
A Yes, please coordinate so they go up around May 6.
B Got it. I'll update the schedule as replies come in.
`),
  budgetShift: parseScript(`
A Let's talk about where to put the $2,000 left in April's budget.
B I'd put it into generic search keywords. There's still room before we hit the ceiling.
C Can't we put more into social? New traffic matters.
B Social's already below average efficiency. Adding more could drag it down further.
A Then this month's leftover goes to search, and we'll revisit social in May.
C Okay. But I'll take a first pass at the May social plan.
A Sounds good. Let's look at it together next Monday.
`),
  kickoff: parseScript(`
A This is the Spring Campaign kickoff. It runs through April, and the goal is a 380% ROAS.
B Ad spend is $50,000 across four channels: search, social, display, and email.
C We'll start with two creatives and swap them after three weeks based on results.
A Please share weekly results every Monday.
B Will do. The first week might be light on data because of setup.
A That's fine. Week one is just to check direction.
C I'll have the dashboard up today.
`),
  pricing: parseScript(`
A Final check on pricing. List price was $28, right?
B Yes. With the 10% first-purchase discount for the waitlist, it's $25.20.
A The discount runs for one week after launch. And no stacking coupons.
B Right. I've already asked dev to block coupon stacking.
C What about bundles? Like a bigger discount if you buy two?
A We decided no bundles for this launch. We want to keep pricing simple.
B Got it. I'll pass today's decisions to dev as is.
`),
  packaging: parseScript(`
A We're looking at two packaging options. Option 1 is a paper sleeve, option 2 is a box.
B The sleeve's cheaper and the box looks more premium. It's about a $0.40 difference per unit.
A We're ordering 3,000, so that's $1,200 total.
C I think the box works better for gifting. Gifts came up in the interviews too.
A We're still checking gift demand, so let's go with the sleeve for now and switch if we see demand.
B Got it. I'll get a quote from the sleeve printer.
`),
  interviewShare: parseScript(`
A This is to share what we learned in the last interviews with the team. There are three main points.
B One, people read the low-star reviews first. Two, the price feels fine once they know the size.
C And three is that they're confused about the order of use, right?
A Right. We can work all three into the product page redesign right away.
B I'll add links to the full interview notes in the shared doc.
A Please redact interviewees' personal info before posting.
B Will do. I'll leave out names and contact info.
`),
  interviewQuestions: parseScript(`
A Let's review the round 4 interview guide. It's at twelve questions right now.
B That's too many. To finish in 40 minutes, eight or so is about right.
A Then let's cut the overlap. I'll merge "what made you buy" and "what you compared it to."
C Please keep the gift question. That's a hypothesis we still haven't checked.
A Yes, the gift question stays. I'll trim the rest and repost it.
B It'd help to add a time split too. Like 5 minutes intro, 30 minutes of main questions, 5 minutes to wrap up.
`),
  recruiting: parseScript(`
A Here's where interview recruiting stands. We got 38 survey responses.
B Eleven of those said they're available for an interview.
A I'll pick five so ages and length of use don't overlap.
B We're offering $50 as a thank-you, right?
A Yes, as a gift card.
B I'll schedule them over three days starting next Tuesday.
`),
  inquiryRule: parseScript(`
A Let's reset our support reply guidelines. First response within 30 minutes during business hours.
B Refund requests get an answer the same day, after we confirm the reason.
C Let's keep the tone friendly and consistent, but not overly casual.
A Agreed. And we only apologize once at the start, not over and over.
B I'll turn our most common replies into templates.
A About ten templates should be enough.
C I'll go through the ticket history to pick those ten.
`),
  dashboard: parseScript(`
A Let's go through the ops dashboard together and sort out which numbers we need.
B Right now there are more than twelve numbers, and I can't tell where to look.
A Let's cut it to four key ones. Ticket volume, first response time, resolution rate, and repeat contact rate.
C Resolution rate needs a clear definition. Is it the customer marking it done, or us closing it?
A Let's count it as resolved if there's no follow-up within 3 days after we close it.
B Got it. I'll put in a request to update the dashboard.
`),
  monthlyRetro: parseScript(`
A Let's do the April ops retro. Want to start with what went well?
B Fixing the routing rules cut first response time. Posting the FAQ helped too.
C What didn't go well: we were short on backup during vacations, so replies were slow.
A In May, let's get vacation plans a month ahead and sort out coverage first.
B We also need a holiday coverage plan by early May.
A Good. I'll draft the holiday plan this week.
`),
  logoReview: parseScript(`
A We're looking at the first logo concepts. There are two: one just has bolder letters, the other has rounded corners.
B I like the rounded one. It ties in with the current brand feel.
C When you shrink them down, the bold one is crisper.
A What if we combine them? Medium weight, with slightly rounded corners.
C I can do that. I'll bring the combined version to the next meeting.
B Let's put two color palettes on that version and look at them together.
`),
  guideReview: parseScript(`
A Let's review the brand guide draft. Starting with the logo usage rules.
B Good that it has minimum size and clear space rules. Don't-do examples too.
A The font section has two typefaces, one for headings and one for body text. Someone mentioned the body font is heavy to load on the web.
C The file is big, that's true, so we should specify a fallback font too.
A Agreed. Please add a fallback font section.
B The photo style section needs more example photos. There are only three right now.
`),
  tone: parseScript(`
A Let's sort out our voice. Right now the website is casual and the emails are formal, so it's a mix.
B I think we should pick one. I'd go with casual.
C Official notices sometimes fit a formal tone better. Especially terms and refund policies.
A Then casual for general info and marketing, formal for terms and notices.
B I'll write some example sentences for the guide.
A And no emojis.
`),
} as const;

export type SmallKey = keyof typeof SMALL_SCRIPTS;
