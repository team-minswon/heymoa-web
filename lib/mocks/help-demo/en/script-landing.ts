import { parseScript } from "@/lib/mocks/help-demo/script";

/**
 * 핵심 회의 2 「신제품 소개 페이지 문구 정리」의 대사. 검토까지 끝나 확정된 회의다.
 *
 * | 라벨 | 사람 |
 * |---|---|
 * | A | 오세라 — 진행 |
 * | B | 최민재 — 문구·디자인 |
 * | C | 김서윤(나) |
 *
 * 한지호는 참석했지만 말하지 않았다(참석자만 있고 화자가 없는 경우의 표본).
 */
export const LANDING_SCRIPT = parseScript(`
A Let's get started. Today we're locking the copy for the new product landing page. It goes to the dev team next Monday, so we need to finish today. @opening
A We'll go top to bottom. Headline, three benefits, ingredients, reviews, and the sign-up button copy at the end.
B Sure. I'll work from the second version I shared yesterday.
C I'll take notes against that draft. Any copy that changes, I'll write down word for word.
A Thanks. Headline first. Right now the draft says "All-day hydration, our new moisturizer."
B Yeah. Honestly, I think it's too generic. Every moisturizer ad says that.
A Agreed. Any alternatives?
B I had two ideas. One shows it in time, like put it on in the morning and you're still hydrated at night. The other leads with how light it feels.
B Something like "12-hour hydration, a lightweight moisturizer." @title-options
C Don't we need proof for twelve hours? Numbers like that can get flagged in ad review.
A Good point. We can only claim 12-hour hydration with a lab report. I asked Jake to check if we have one, but haven't heard back.
B No report, no numbers.
A Right. So how about we pick a headline without numbers now, and add the number to the subhead only once the report's confirmed?
B Works for me. Headline is "A lightweight moisturizer that sinks right in," and the subhead gets a number after we see the report. @title-decision
C I'll write the headline as "A lightweight moisturizer that sinks right in." Subhead's on hold.
A Yep. And I'll follow up on this. I'll ask Jake about the lab report again today. @report-check
A Next, the three benefits. The draft has one, deep hydration, two, a soft feel, and three, gentle on sensitive skin.
B One and two read like the same thing to me. Deep hydration and a soft feel will feel like one point to customers.
A Fair. So how do we split them?
B What if we combine hydration and feel, and call out that it's nearly fragrance-free on its own? In the last interviews, a lot of people were sensitive to scent.
C Right. In round two, three people said they'd stopped using a cream halfway because of the scent.
A Then the benefits are one, lightweight hydration that sinks in, two, nearly fragrance-free so it's easy to wear, and three, gentle on sensitive skin. @benefits-decision
B Good. Oh, but we can't say fragrance-free. It has to be nearly fragrance-free. It's not completely unscented.
A Right, we have to stick to that. Emma, can you note that?
C Sure, I'll note that we only say nearly fragrance-free and never use the word unscented. @no-fragrance
A The sensitive skin wording in the third benefit needs checking too. That also needs test results.
B My understanding is it's fine if we don't say it's for sensitive skin, just that it's made to be gentle on sensitive skin.
A That should be fine. But we still need to confirm, so let's run the final copy past legal. @legal-review
C Should I send the request to legal?
A Yes, please take that, Emma. Send it as soon as the final copy is ready.
C Will do.
A Next, ingredients. Right now we just list three names: hyaluronic acid, ceramides, and panthenol.
B Just names won't mean anything to people. I think we need a one-line explanation for each.
A Agreed. What tone? Too technical will lose people.
B Plain language. Hyaluronic acid holds in moisture, ceramides strengthen the skin barrier, panthenol soothes dry skin. Something like that. @ingredient-copy
C That's easy to follow. And it doesn't make hard claims, so it should be fine for ad review.
A Great. So each ingredient gets a one-line explanation next to the name. Marcus, can you write those up and send them?
B Sure, I'll send them today.
A Now the reviews section. Right now we have three beta tester reviews.
B All three say the same thing. Hydrating, light, absorbs fast. When every review sounds the same, it looks like an ad and people trust it less.
A So what do we do?
B Instead of only praise, I'd add one or two like "I was worried it'd be sticky, but it felt surprisingly fresh."
C There are reviews like that in the beta survey. I'll look. I'll only use ones with consent. @review-pick
A Great. Let's do four reviews total. Emma, pick two more with a different tone from the ones with consent.
C Sure, I'll have them by next Monday.
B What if we put the average star rating above the reviews? It came out around 4.6.
A We only had twelve beta testers, so the sample's too small. Showing an average big could mislead people.
B True. Then no stars, just the review text.
A That's safer. And we'll add a small source line saying they're beta tester reviews. @review-source
C I'll write the source line as "Beta tester reviews."
A Last one, the sign-up button. Right now it says "Pre-register."
B Pre-register isn't bad, but it doesn't say what happens when you click. It'd be better to say you'll get a launch alert.
A Then let's make the button "Notify me at launch," with a line right below like "We'll only email you about the launch if you sign up." @cta-decision
B Good. I think it's fine if it's a little long.
C Button is "Notify me at launch," and the line below is "We'll only email you about the launch if you sign up."
A Yep. And are we only sending alerts by email, or text too?
B Let's do email only this time. Texts need a separate opt-in process, and that adds time.
A Agreed. Email only. We'll revisit texts next launch. @email-only
C We need email consent copy too, right?
A Yes, we need a privacy consent checkbox. Legal has standard wording we can use.
C I'll find that and add it to the draft.
B So the sign-up form only needs two things, email and privacy consent.
A We don't need a name, right? Every field we cut makes it easier to sign up.
B Let's drop the name. We don't need it for a launch alert.
A Let me recap. Form is one email field and one consent box. Alerts by email only. Right?
C Right. Got it.
A One more question. What about the FAQ at the bottom of the page? It's not in the draft.
B Since it's a pre-launch page, I think three FAQs is enough. When it's coming out, how much it costs, and where to buy it.
A We haven't locked the price or launch date yet.
C I heard launch is planned for mid-May, and price gets set in the pricing meeting.
A Then let's fill in the FAQ once the date and price are set, and just leave the section empty in this draft. @faq-hold
B Sounds good. If we build it collapsed, it'll be easy to fill in later.
C I'll leave it as an open question. Fill in the FAQ once the launch date and price are set.
A Great. So next Monday we hand off everything to dev except the FAQ.
B It's tight, but doable. I'll pull together the final copy by Friday. @deadline
A Then Emma sends it to legal as soon as the Friday final is ready, and we aim to hear back by Monday morning.
C I'll ask legal to reply by Monday morning. If that doesn't work, I'll let everyone know right away.
A Okay. What about design? If the copy changes, the mockup changes too.
B Once the copy's locked, design takes three days. This week won't work, but I can deliver final design next Wednesday.
A Then we send dev the copy on Monday and the design separately on Wednesday.
B That's realistic.
C Let me read back the schedule. Final copy this Friday, legal reply next Monday morning, copy to dev Monday, final design Wednesday.
A That's right, exactly.
A Oh, we missed one. The short label over the hero image. It can't repeat the headline.
B I was going to put just one line saying it's new. The headline's already long enough.
A I like that. Instead of "New product," we could keep it light with "Just launched."
B "Just launched" feels friendlier. Let's go with that. @hero-label
C Does the headline wrap to two lines on mobile? It looks a bit long.
B The headline fits on two lines on mobile, but with the subhead it's three. So I'm planning to hide the subhead on mobile.
A The subhead's on hold anyway, so let's revisit when we add the number.
C We need alt text for the images too, right? For people using screen readers.
B Yes, every image gets alt text. For the product shot, I'll write "Moisturizer jar and texture close-up."
A Accessibility is easy to miss, so thanks for catching it. Marcus, can you own that too?
B Will do.
A Let me recap today's decisions. Headline is "A lightweight moisturizer that sinks right in." Benefits combine hydration and feel, with nearly fragrance-free on its own. One-line ingredient descriptions. Four reviews, no star rating. Button is "Notify me at launch." @summary-decisions
C Also, the form is just email and consent, alerts are email only, and the FAQ section stays empty for now.
A Right. Thanks for keeping track, Emma. Last, let's confirm tasks.
A Jake needs to check the lab report today, but he's not on the call, so I'll reach out to him.
C Jake was on the invite but didn't speak. In the notes, I'll put that one under Sophie.
A Yes, do that. That's it for today. Thanks, everyone. @closing
B Thanks, everyone.
C Thanks.
`);
