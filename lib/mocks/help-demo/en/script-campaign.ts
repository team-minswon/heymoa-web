import { parseScript } from "@/lib/mocks/help-demo/script";

/**
 * 핵심 회의 1 「4월 캠페인 성과 리뷰」의 대사. 가상의 마케팅 팀이 한 달 캠페인 숫자를 같이 보는 회의다.
 *
 * | 라벨 | 역할 | 비중 |
 * |---|---|---|
 * | A | 퍼포먼스 마케터(박도윤) — 숫자를 길게 설명한다 | 가장 많음 |
 * | B | 팀장(이하린) — 묻고 결정한다 | 많음 |
 * | C | 크리에이티브(최민재) | 중간 |
 * | D | 기록 담당(김서윤, 나) | 적음 |
 *
 * 숫자는 한 번 정한 값을 끝까지 쓴다 — 광고비 4,800만 원, 클릭 22만 6천, 전환 5,420건, 매출 1억 9,300만 원.
 */
export const CAMPAIGN_SCRIPT = parseScript(`
B Okay, looks like everyone's here. Let's kick off the April campaign review. @opening
B We've got four things today. Overall numbers, channel comparison, creative test results, and then the May budget and targets.
A Yep, I reran the numbers last night. Let me share my screen.
D Emma here. I checked that the recording's working, and I'll take notes.
B Thanks. Let's wrap this up within an hour.
C I've got a few things on creative, so I'll jump in on the third item.
B Sounds good. Daniel, want to start?
A Can you all see my screen?
D Yes. Could you zoom in a little?
A Is this better?
B Perfect, I can read it now.
A Let's start with the totals for April. That's April 1 through 30, and we spent $48,000 on ads. That's $2,000 under the $50,000 plan. @spend
A We got 12.6 million impressions and 226,000 clicks. So CTR is 1.8%. @ctr
B What was CTR last month?
A March was 1.5%, so we're up 0.3 points. Average CPC was about 21 cents, roughly 2 cents lower than March.
B Oh, CPC came down too? That's a good sign.
A Yeah. Purchases came in at 5,420, so the conversion rate is 2.4%. March was 2.1%, so that's up too. @conversion
C Some of that lift is probably the product page redesign. It went live the second week of April.
A Right, we'll come back to that in the funnel. On revenue, ad-attributed revenue was $193,000. @revenue
A That puts ROAS at about 402%. The target was 380%, so we beat it by 22 points. @roas
B Nice. That's the first time we've hit target this quarter, right?
A Yep, first time. January through March we were stuck between 350 and 370.
D Let me write those down. Spend $48K, clicks 226K, purchases 5,420, revenue $193K, ROAS 402. Right?
A That's right. They're rounded, so they may be a little off from the source sheet.
B That's fine. Rounded numbers in the notes, and we'll link the sheet.
D Will do.
A One more thing. This ROAS is last-click. Anyone who found us through email or social and then came in through search gets counted as search.
B That's always the catch. We'll keep it in mind on the channel breakdown.
C Quick question. Do we have the split between new and returning customers?
A We do, but it's not in today's deck. I think new customers were around 38%, but I'll confirm and send the exact number. @newcust
B We need that for the May targets, so please get it out today.
A Got it. I'll send it today.
B If there are no more questions on totals, let's move to channels.
D None from me.
C Me neither.
A Next slide, then. Channel comparison. I split it into search, social, display, and email.
A By spend, social was the biggest at $21,000, then search at $18,000, display $6,000, and email $3,000. @channels
B Was social being the biggest part of the plan?
A Yes, in April we put extra into social to bring in new customers. But it was less efficient than search.
A ROAS by channel: search 520%, social 310%, display 180%, and email 780%. @channel-roas
C Email at 780 is way ahead.
A Email goes to people who've already signed up, so it costs almost nothing. It's not really a fair comparison.
B Still, per dollar it's the most efficient. Grace runs email, right?
A Yes, Grace segmented the list and sent those. She couldn't make it today.
B Okay. We'll ask Grace about email directly later.
D I'll log the email segments as a task.
A Search varied a lot by keyword group. Brand keywords hit 900% ROAS, but generic keywords were only 280%. @search-keyword
B Brand keywords are people already searching for our name anyway.
A Exactly. Take brand out, and search is about as efficient as social.
B Call that out separately in the report. Otherwise search looks too good to leadership.
A Will do. I'll make a table that splits brand and generic.
C Which placement did best on social?
A Video had the higher click-through, but image ads converted better. Video CTR was about 2.6%, image about 1.4%, and conversion rate was the other way around. @video-image
C So people watch the video and leave, but they come in from images to buy.
A That's one way to read it. So video should do awareness and images should do conversion.
B I like that split. What about display?
A Honestly, display was the weakest. We spent $6,000 and only got $10,800 in revenue. That's 180% ROAS, less than half the 380% target. @display
B Display was about the same last month, wasn't it?
A Yes, March was around 200%. I tried narrowing the targeting, but it didn't change much.
B Then we should cut display in May. Let's decide that with the budget. @display-cut
D I'll note display as a candidate for cuts.
A One thing to add. Display doesn't convert directly, but it may help behind the scenes. People see the ad and search for us later.
B We can't prove that, though. $6,000 is too much to keep spending on a hunch.
A Fair. That's why I wanted to propose comparing against a region with no display for a month. A simple holdout test. @holdout
B Wouldn't that cost more money?
A If we use part of what we cut from display, there's almost no extra cost.
B Then bring me a test design. We'll look at it next week.
A Okay, will do.
D I'll put the holdout test design down as Daniel's task.
A Sounds good.
B Let's leave channels there and move to the third item. Marcus.
C Sure, here are the creative test results. In April we ran two versions, A and B. A was product photos, B put real customer reviews front and center. @abtest
C We split impressions about 50/50 over three weeks. Creative A had a 1.5% CTR and B had 2.3%.
B That's a big gap. Conversion rate?
C B was higher there too. A was 2.1%, B was 2.9%. @abtest-result
A I checked the sample size. Each had over 100,000 clicks, so the difference is statistically significant.
B So B is the clear winner.
C Yes. Big customer reviews got a better response. The gap was biggest with women in their late 20s to early 30s.
D Is there a breakdown by age? I'd like it in the notes.
C There is. I'll send the sheet link after.
B Sounds like we need more review creative. Do we have enough reviews to work with?
C We have about twelve, but only seven gave photo consent. We'd need to reach out to the rest. @review-consent
B Don't use any without consent. Can you make three versions from those seven?
C Seven is enough to mix into three. I can have drafts by the second week of May. @creative-three
B Great. Daniel, have the ads set up so they can go live as soon as those are ready.
A Sure, setup takes a day.
C My one worry is that reviews in the same tone wear out fast. CTR tended to drop after four weeks.
A Good point. I'll add a frequency cap too. No more than three times a week per person.
B Great. Daniel, you own that.
D Got it: three B variations for Marcus, frequency cap for Daniel.
C That's right.
B If that's it for creative, let's look at the funnel. We said conversion went up, so let's see where.
A I looked at four steps: product page, cart, checkout start, and purchase.
A Of people who land on the product page, 38% add to cart, 61% of those start checkout, and 72% of those finish. @funnel
B What was March?
A Add to cart was 34%, checkout start 60%, and completion 69%. So the biggest jump is product page to cart.
C That's the redesign. We moved the product details up and pulled reviews higher.
A Exactly. But checkout start to purchase is still 72%, so more than one in four drop off.
B That's a shame. Why are people dropping at checkout?
A The data says it's mostly the payment method screen. Someone suggested adding another one-click payment option. @checkout-drop
B That needs dev time, so we can't decide it here. Let's just log it as an issue.
D I'll log adding a payment method as an issue for the dev team.
B Okay. And we were retargeting people who left the cart, right?
A Yes, we retargeted cart abandoners with a 7-day window, and that ROAS was 560%. Almost double regular social. @retarget
C Creative matters a lot for retargeting. What's running there now?
A Creative A. Since B just won, switching retargeting to B could push it higher.
B Then let's switch retargeting to B first. No need to wait for new drafts, we can use the B we have.
A Okay, I'll switch it today. @retarget-switch
C What about testing a 14-day window? Seven days might be too short.
A I'd like to, but a longer window keeps showing ads to people who already bought. That's wasted spend. We'd need a buyer exclusion list.
B Do we have one?
A We do. Buyers are excluded for 30 days.
B Then run a small 14-day test. Use 30% of the retargeting budget. @retarget-test
A Got it. I'll run 14 days against 7.
D I'll add the window test to Daniel's tasks.
A Thanks.
B That covers the funnel. Last item, May budget and targets. Leadership set May at $50,000. @may-budget
B We spent $48,000 in April, so that's $2,000 more. How should we split it?
A Here's my take. Cut display from $6,000 to $3,000. Of that $3,000, put $2,000 into generic search and $1,000 into email. Keep social at $21,000. @budget-shift
B What's the total? Where does the extra $2,000 go?
A Oh, right. I'd put the extra $2,000 into retargeting, since it's at 560%.
D So: search $18K to $20K, social stays at $21K, display $6K to $3K, email $3K to $4K, and $2K new for retargeting. Right?
A Yep. Search 20, social 21, display 3, email 4, retargeting 2. That's $50K total.
B Adds up to exactly 50. Social at 21 still feels high, though. Could we move some of it to search?
A Generic search has a ceiling. Search volume is fixed, so more budget gets much less efficient. I'd say 20K is the limit. @search-limit
B Okay. Then social stays. It brings in new customers too.
C If we shift social from video toward images, efficiency should go up a bit.
A Agreed. I'll move the video-to-image split within social to about 30/70. @social-ratio
B Great. I'll write up the budget that way and send it to leadership. @budget-confirm
D Final budget sign-off goes to Olivia.
B Yep, I'll send it by this Friday.
B Now targets. I'd like May ROAS at 450%. April was 402%, so that's a stretch. Thoughts? @okr
A 450 won't be easy, but with retargeting and creative B, it's doable. Cutting display alone will lift the average.
C I think it's doable too. But the review creative won't land until the second week of May, so the first week won't see much impact.
B Then let's measure 450 as the May average and treat the first week as an exception.
A Sounds good.
B I'd like to raise conversion rate from 2.4% to 2.6%. And new customers were around 38%, right?
A Yes, I'll send the exact number today, but it's about 38%.
B Getting that to 45% is our second key result. New traffic from social should support it. @kr-newcust
D So for OKRs: the objective is a more efficient spring campaign. KR1 is 450% May ROAS, KR2 is 45% new customers, and I'll list 2.6% conversion rate as a supporting metric.
B Yes, let's do that. Keep conversion rate as a supporting metric, not a KR.
A Should we update the quarterly KPI doc too?
B Yes. Emma, could you update the KPI doc as well?
D Sure. I'll update it this week.
C May has holidays, so the first and last weeks could be weaker. Should we account for that in the targets?
B Good catch. Do we have numbers from last year's May holidays?
A We do. Clicks went up over the holidays, but conversion rate actually dropped about 0.5 points. @holiday
B So do we set different targets for the holidays, or just let it average out?
A Averaging is simpler. But let's do a check-in right before the holidays.
B Okay. I'll schedule the pre-holiday check-in when we get closer.
D I'll leave how to handle holiday targets as an open question.
B Sounds good.
B That's it for targets. Let's quickly settle reporting too. Right now we only report at month end, so we didn't see what was going off track.
A Right. In April we knew display was weak by week two, but we only looked at it together at month end.
B So starting in May, I want weekly reporting. A one-pager every Monday morning.
A What goes on it? If we put too much, nobody reads it.
B I think four things. Budget pacing, ROAS, conversion rate, and new customer share. By channel, just ROAS. @weekly-report
A Got it. So we can drop CTR and CPC?
B Those can live in the detail sheet. They don't need to be on the one-pager.
C I'd like one line for CTR by creative. That's how we'll catch creative fatigue.
A Then I'll add two lines just for creative. The live creative names and their CTR.
B Great. Emma, could you own the one-pager? Daniel just needs to give you access to the sheet.
D Once the sheet's set up, I can mostly automate it. I'll have it up every Monday by 10 a.m.
A I'll set up the sheet this week. It only needs about ten columns.
D Thanks. Then the first weekly report goes out next Monday. @weekly-start
B Great. We also need to agree on definitions. Some people calculate ROAS on revenue, some on gross order value.
A Right now it's net revenue after refunds. April's 402% is net revenue too.
B Then let's add one line at the bottom of the report with the definition. Net revenue, last-click.
D Sure, I'll make that a fixed footer on the report.
C If it's last-click, then like you said, social gets less credit.
A That's why I want to do a separate attribution look for social. The share of people who saw a social ad and then bought through search within a week.
B Do we have the data for that?
A We can do it with cookies, but it's not very accurate. It's more of a rough read. @attribution
B A rough read is fine. Try it once, just as input for the social budget.
A Okay, I'll have it before the next meeting.
D I'll add the attribution estimate to Daniel's tasks too.
A Thanks. Oh, and one more thing on email. Grace sent an email with a coupon at the end of April, and that pushed ROAS up a lot.
B It was a coupon email? I didn't know that. How much off?
A It was a 10% coupon, and conversions were about double normal for three days after it went out. The 780% email ROAS is partly the coupon, so without it the number could be lower. @coupon
B Oh, so email isn't always 780%. And if you count the coupon margin, it could be a lot lower.
A Exactly. So before we put more into email, we need to look at non-coupon emails on their own.
B Then let's use the extra $1,000 for email to test emails without a coupon.
A Sounds good. I'll ask Grace to split the sends into with and without coupon.
B I'll talk to Grace about that. I'll bring it up when I ask about the segments.
D I'll note that Olivia will pass the coupon comparison on to Grace.
B Okay. And one more thing. Whether coupon promos are good for the brand long term isn't really our call. It ties into pricing.
A Agreed. Let's just keep the coupon as a note.
D I'll add it as a note. The coupon email doubled conversions.
C I'm also curious about new customers. I'd like to see how many come back and buy again.
A Repeat purchase isn't in this campaign's scope, so I'd have to pull it separately. On a 30-day basis, April's new customers won't be done until the end of May.
B Let's put that on the agenda for early June. @repurchase
D I'll log the early-June repeat purchase check as an open question.
B Before we wrap, let's go through today's tasks. Emma, could you read them out?
D Sure. One, Daniel shares the exact new customer share today. Two, Daniel builds a search table split by brand and generic keywords. @owners
D Three, Daniel brings the display holdout design before next week's meeting. Four, he switches retargeting to creative B and sets up the 14-day window test.
D Five, Marcus makes drafts of three review creative variations by the second week of May. Six, Olivia sends the May budget by this Friday.
D Seven, I update the KPI doc this week. Eight, the payment method request goes to the dev team as an issue. Nine, someone asks Grace about the email segments.
B Almost. I'll file the payment method issue, since I need to talk to the dev team.
D Oh, then I'll change that one to Olivia.
B Yep. And I'll ask Grace about the segments myself. No need to add to your plate, Emma.
D Thanks. I'll update those.
A For the numbers, Emma, just give me access to the sheet and I'll share right away.
D Doing it now. You've got edit access on your account, Daniel.
A Got it. Thanks.
C Quick question on the review creative. How prominent should the product name be? Do we need legal to look at it?
B As long as the review copy doesn't make definitive claims about results, it's fine. I'll take a look when the drafts are ready. @legal-check
C Got it. I'll leave out any definitive claims.
B To recap what we decided: retargeting switches to creative B right away, the May budget is search 20K, social 21K, display 3K, email 4K, retargeting 2K, the ROAS target is 450%, and the new customer target is 45%.
D That's right. It'll all be in the meeting notes.
B Thanks, everyone. Same time next week. Bring the display test design. @closing
A Thanks, everyone.
C Thanks.
D Thanks. I'll share the notes as soon as they're done.
`);
