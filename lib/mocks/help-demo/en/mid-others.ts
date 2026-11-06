import { anchorsOf, parseScript } from "@/lib/mocks/help-demo/script";
import type { MidMeeting } from "@/lib/mocks/help-demo/en/mid-campaign";

/** 출시 일정 점검. 화자 A 오세라, B 한지호, C 최민재. */
const launchScript = parseScript(`
A Three weeks to launch. Today let's go through what's left by date and see if anything's slipping.
A Jake, can you start with dev?
B The waitlist page is about 80% done. Sending the reminder emails is what's left. We can put it on staging next Wednesday.
A Email sending needs the template locked first. That's being handled in another meeting, so it should be settled this week.
C I can get you the template draft by tomorrow. Once the copy's final, it takes a day to put in.
B So if the copy is final Friday, it goes in Monday and we still hit staging Wednesday.
A Great. And QA after that?
B QA takes two days after staging. So we can wrap it up next Friday. @qa
A Launch week starts on a Monday. If QA's done Friday, we have the weekend as a buffer, so we're fine.
C On design, the product detail images are left, but only about half the photos have come in.
A What's the timeline on the photos?
C The studio said they'll send the other half this Thursday. Retouching takes two days.
A So the detail images are done next Tuesday, and dev puts them in the day after.
B Adding images takes half a day. Not a big deal.
A What do you see as the biggest risk?
B Checkout integration worries me most. We decided to add pre-orders, but the payment provider hasn't finished reviewing us. @payment-risk
A When does the review finish?
B Our contact said five business days, and it's already been four since we applied. We should hear back this week.
A What if it runs late?
B We can still launch with just the waitlist and no pre-orders. Purchases would open on launch day.
A Then let's set it now: if the review isn't back by Friday, we drop pre-orders. @fallback
C If we drop pre-orders, the marketing copy has to change. I'll get that ready just in case.
A Thanks. Let's cover the marketing timeline separately next meeting.
A So we decided two things today. QA wraps by next Friday, and if the payment review isn't back by Friday, pre-orders come out. @decision-date
B Yep, that's right.
A And launch day stays May 14. @launch-date
C Got it.
A Jake, please follow up with the payment review contact today.
B Will do. I'll call this afternoon.
A Marcus, please keep track of the template draft and the retouching schedule for the detail images.
C Sure.
`);
const l = anchorsOf(launchScript);

export const LAUNCH_MEETING: MidMeeting = {
  script: launchScript,
  headline: "Launch stays on May 14, and pre-orders depend on the payment review",
  lead: [{ text: "QA wraps by next Friday. If the payment review isn't back by Friday, we skip pre-orders and open only the waitlist.", topics: [1] }],
  topics: [
    {
      title: "Launch timeline and risks",
      hasAgenda: false,
      items: [
        { kind: "DECISION", content: "Keep launch day on May 14", at: l("launch-date") },
        { kind: "DECISION", content: "If the payment review isn't back by Friday, skip pre-orders and open only the waitlist", at: l("fallback") },
        { kind: "DECISION", content: "Finish QA by next Friday", at: l("qa") },
        { kind: "ACTION_ITEM", content: "Follow up with the payment review contact today", at: l("payment-risk"), who: "B", dueIn: 0 },
        { kind: "ACTION_ITEM", content: "Send the reminder email template draft", at: l("qa"), who: "C", dueIn: 1 },
        { kind: "ACTION_ITEM", content: "Prepare marketing copy for launching without pre-orders", at: l("fallback"), who: "C", dueIn: 5 },
        { kind: "ISSUE", content: "If the payment review is delayed, pre-orders can't open", at: l("payment-risk") },
      ],
      sentences: [
        { text: "Launch day holds, and QA wraps next Friday.", items: [0, 2] },
        { text: "If the payment review runs late, we skip pre-orders and open only the waitlist.", items: [1, 6] },
      ],
    },
  ],
};

/** 사전 신청 안내 메일 검토. 화자 A 오세라, B 정유나, C 김서윤. */
const mailScript = parseScript(`
A Let's go over the waitlist email drafts together. Grace, you wrote these?
B Yes, I wrote two versions. One's short and just covers the perks. The other's longer and includes a product description.
A Let me read the short one first. The subject line is "Thanks for signing up for launch updates."
B Yeah, but it felt kind of stiff, so I was thinking of changing it.
C I don't think people will open it either. They'll open a confirmation email, but for the updates after that, the subject line matters.
A This one's the confirmation that goes out right after sign-up. The subject isn't a big deal there. What matters is that the body tells them what they'll get next.
B Right. That's why the body says we'll send an update three days before launch. @notice-date
A Good. Then let's say we'll email twice: three days before launch and on launch day. @two-mails
C Saying it's only two emails builds trust. It won't feel like spam.
B I'll add that line. The unsubscribe link goes at the very bottom too.
A The longer version has an ingredients section. That's too much for a confirmation email.
B I agree. What if we use the short one for confirmation and the long one for the email three days before launch?
A Let's do it. Short version for confirmation, long version right before launch. @split-use
C The first sentence of the long version is a bit long. Once a sentence goes past 25 words, it's hard to read on mobile.
B I'll split it into two sentences.
A The button says "Learn more" right now, but for the email three days before launch, "See it now" fits better.
C I like "See it now" too. Clicking it goes to the product page.
A Then let's switch to that. @button
B When should it go out? 9 a.m., or right before lunch?
C Our past email data shows open rates peak around 10:30 a.m.
A Then 10:30 a.m. it is. @send-time
B Got it. I'll schedule it in the email tool.
A Last thing, the audience is everyone on the waitlist, right? What about duplicate sign-ups?
B If someone signs up more than once with the same email, they only get one.
C I'd like to see the unsubscribe rate too. I want to know if two emails is too many.
B The email tool shows unsubscribes. I'll pull the numbers a week after launch.
A Good. If unsubscribes go over 1%, we'll revisit the frequency.
C What about an internal send? I'd like us to get it ourselves before it goes out for real.
B I'll send it to five internal addresses first. And check how it looks on mobile.
A Mobile is the most important part. Please check that it still reads well when images don't load.
B I'll check the no-image version too.
A Great. Please share the revised drafts by tomorrow.
B Will do. I'll send them by tomorrow afternoon.
`);
const m = anchorsOf(mailScript);

export const MAIL_MEETING: MidMeeting = {
  script: mailScript,
  headline: "Waitlist emails split into a sign-up confirmation and a launch preview three days out",
  lead: [{ text: "The confirmation stays short and the three-days-out email goes long. Sends are scheduled for 10:30 a.m.", topics: [1] }],
  topics: [
    {
      title: "Waitlist email structure",
      hasAgenda: false,
      items: [
        { kind: "DECISION", content: "Use the short version for confirmation and the long version for the email three days before launch", at: m("split-use") },
        { kind: "DECISION", content: "State in the body that we'll only email twice: three days before launch and on launch day", at: m("two-mails") },
        { kind: "DECISION", content: "Change the button copy to \"See it now\"", at: m("button") },
        { kind: "DECISION", content: "Send at 10:30 a.m.", at: m("send-time") },
        { kind: "ACTION_ITEM", content: "Share both revised email versions", at: m("notice-date"), who: "B", dueIn: 1 },
        { kind: "ACTION_ITEM", content: "Split the first sentence of the long version into two", at: m("split-use"), who: "B", dueIn: 1 },
      ],
      sentences: [
        { text: "Emails are split by purpose, and we'll only send two: three days before launch and on launch day.", items: [0, 1] },
        { text: "Button copy and send time are set.", items: [2, 3] },
      ],
    },
  ],
};

/** 고객 인터뷰 3차. 화자 A 최민재(진행), B 박도윤, C 김서윤. */
const int3Script = parseScript(`
A Let's go through round 3 together. We talked to five people this time, all working professionals in their 30s.
B I sat in on two, and one thing came up in both. They always look up reviews before buying, but they don't trust them.
C Looking them up but not trusting them sounds like a contradiction. Was there context?
B They said a lot of reviews read like ads. So they read the low-star reviews first on purpose. @low-review
A Yep. Two of mine said the same thing. Reviews that mention downsides actually feel more trustworthy to them.
C Then it might help to show downsides on our product page instead of hiding them.
A The question is how. It can't come across as the product being bad.
B Something like "Some people find it a little plain since it's nearly unscented" is honest without being a turnoff.
A Let's put one or two lines like that in the reviews section. @honest-copy
C What else came up?
A Reactions to price were split. Two said it's expensive, three said it's reasonable.
B The two who said expensive didn't know the size. After they saw the size info, they said it was fine.
A So instead of just the price, we should show how long one jar lasts. Something like "one jar lasts two months." @price-frame
C That needs backing. How many weeks did beta testers use it on average?
B Eight weeks on average. Six at the shortest, eleven at the longest.
C Then we use the eight-week average and add that it varies by person.
A Good. One more thing, packaging came up twice. They bought it as a gift and wished the packaging was nicer.
B That suggests separate gift demand, but it's a hypothesis we haven't checked yet. @gift-question
C Let's ask in the next round whether people want a gift wrap option.
A I'll add a gift question to the next interview guide.
B I want to flag that lots of people asked about the order of use. Three weren't sure if it goes on after toner or after serum.
C We already talked about adding a how-to-use section to the product page, right?
A Yes, and this round gives us clear evidence that we need it. @usage-guide
B One more. Two people said they look at review photos first. Photos tell them more about the texture than the text does.
A So we should put photos in the reviews section. We're already getting photo consent, right?
C Yes, the consent form has a separate photo item. Five of the seven agreed to photos.
A Five is plenty. We can put a photo on all four reviews.
B Someone also asked how long it lasts. They wanted to know how long one jar goes.
A We can put that eight-week average near the bottom of the product page.
C That line needs a legal review, so I'll send it over with the rest.
C Got it. I'll post the summary in the shared interview doc.
A Thanks. I'll schedule round 4 for next week.
`);
const i3 = anchorsOf(int3Script);

export const INTERVIEW3_MEETING: MidMeeting = {
  script: int3Script,
  headline: "Round 3 confirmed that people trust reviews that mention downsides",
  lead: [{ text: "Price will be shown with how long one jar lasts, and a how-to-use guide is clearly needed.", topics: [1] }],
  topics: [
    {
      title: "Round 3 interview recap",
      hasAgenda: false,
      items: [
        { kind: "DECISION", content: "Add one or two honest downside lines to the reviews section", at: i3("honest-copy") },
        { kind: "DECISION", content: "Show price together with how long one jar lasts (8 weeks on average)", at: i3("price-frame") },
        { kind: "DECISION", content: "Add a how-to-use guide to the product page", at: i3("usage-guide") },
        { kind: "ACTION_ITEM", content: "Post the interview summary to the shared doc", at: i3("usage-guide"), who: "C", dueIn: 1 },
        { kind: "ACTION_ITEM", content: "Add a gift question to the round 4 interview guide", at: i3("gift-question"), who: "A", dueIn: 3 },
        { kind: "ACTION_ITEM", content: "Schedule round 4 interviews", at: i3("gift-question"), who: "A", dueIn: 5 },
        { kind: "QUESTION", content: "Is there separate gift demand, and do we need a gift wrap option?", at: i3("gift-question") },
      ],
      sentences: [
        { text: "People trust reviews that show downsides.", items: [0] },
        { text: "The product page will do a better job on price and order of use.", items: [1, 2] },
      ],
    },
  ],
};

/** 고객 인터뷰 2차. 화자 A 최민재, B 이하린, C 박도윤. */
const int2Script = parseScript(`
A Here's what we heard in round 2. This time we met people who bought again after their first purchase. Four of them.
B I'm curious what made them buy again. Who were they?
A Three ran out and bought more. One recommended it to family and then bought again.
C The ones who ran out, did they buy the same product right away or compare first?
A No comparing. They liked it, searched the name, and bought it right away. @repurchase
C So repeat customers come in through brand search. That explains why our branded search keywords perform so well.
B So we should separate those out when we look at ad performance.
C Right. We talked about that in the last meeting too.
A I also asked what tipped the first purchase, and three said a friend recommended it. Only one bought from an ad.
B Small sample, but word of mouth matters more than ads.
A That's where the referral idea came from. You refer a friend and you both get a perk.
C Referral programs work well, but they're a hassle to manage. We'd need abuse protection too.
B Even if we don't do it now, let's put it on the list to review. @referral
A There were complaints too. Two said it's a pain to rebuy every time since there's no subscription.
B A subscription isn't in the plan right now. That's a product call, so I'll pass it to the CEO.
A Thanks. Packaging size came up too. Some wanted a small pouch size.
C A small size works like a sample, so it's great for marketing. It lowers the bar for a first purchase too.
B We should find out what small samples would cost to make.
C I'll ask the vendor for a quote. I can get it this week. @sample-quote
A Thanks. Last thing, starting with round 3 I want to recruit participants a different way.
B How?
A Send a survey to existing customers first, then pick people who say they're open to being contacted. @recruit
B Nice. How many questions in the survey?
A Five or fewer, with one at the end asking if they'd join an interview.
C Did you ask about repurchase timing? How many weeks before they buy again?
A Mostly between seven and nine weeks. That lines up with the eight weeks of use we heard earlier.
C Then a repurchase reminder email around week seven would hit the right timing.
B Let's hand that idea to email. I'll pass it on to Grace.
A One person said they switch back and forth with another brand. They don't only use ours.
C That's normal. We should focus on getting picked more often, not on loyalty.
B Good way to put it.
B Got it. Share the survey draft once you have it.
`);
const i2 = anchorsOf(int2Script);

export const INTERVIEW2_MEETING: MidMeeting = {
  script: int2Script,
  headline: "Repeat buyers search our name and buy, and first purchases came from friends' recommendations",
  lead: [{ text: "The referral program goes on the review list, and we'll get a quote for small samples. Recruiting switches to a customer survey.", topics: [1] }],
  topics: [
    {
      title: "Round 2 interview recap",
      hasAgenda: false,
      items: [
        { kind: "DECISION", content: "Hold off on a referral program and add it to the review list", at: i2("referral") },
        { kind: "DECISION", content: "Recruit participants by surveying existing customers first", at: i2("recruit") },
        { kind: "ACTION_ITEM", content: "Ask the vendor for a quote on small samples", at: i2("sample-quote"), who: "C", dueIn: 5 },
        { kind: "ACTION_ITEM", content: "Draft a customer survey with five questions or fewer", at: i2("recruit"), who: "A", dueIn: 4 },
        { kind: "ACTION_ITEM", content: "Pass the subscription request to the CEO", at: i2("referral"), who: "B", dueIn: 2 },
        { kind: "STATUS_REPORT", content: "Repeat customers searched our name and bought right away", at: i2("repurchase") },
      ],
      sentences: [
        { text: "Repeat purchases came through brand search, and first purchases through recommendations.", items: [5] },
        { text: "The referral program is on hold for review, and recruiting moves to a survey.", items: [0, 1] },
      ],
    },
  ],
};

/** 주간 운영 점검(지난주). 화자 A 정유나, B 한지호, C 오세라. */
const weeklyScript = parseScript(`
A Let's start with last week's ops numbers. We got 273 support tickets, down 8% from the week before. @inquiry
B Average first response time is down to 36 minutes too. That's getting close to the 30-minute target.
C Do we know why it dropped? Is that from changing the routing rules?
B Partly the routing fix, and partly putting the FAQ on the website. How-to questions dropped 25%.
A So both worked. If we add more to the FAQ, will tickets drop further?
C Adding the top five repeat questions to the FAQ worked this time, so let's add the next five. @faq
B I'll pull the top five. I'll have them to you this week.
A Next is refunds. We had 31 refund requests, and the top reason is change of mind.
C There's not much we can do about change of mind. How many were damaged packaging or wrong items?
A Two wrong shipments. Both were the same day, same packer, so we need to look into it.
C To see if it's a person issue or a process issue, we'd need that day's shipping list.
A I'll ask logistics for the shipping list. This isn't about blaming anyone, just finding the cause. @misship
C Please make that clear. We're checking whether we can change how orders get verified.
B Adding a barcode scan step would nearly eliminate wrong shipments. It'd cost about two scanners.
C How much is a scanner?
B About $120 each. So $240 for two.
C At that price we can submit for approval right away. One wrong-shipment refund costs more than that. @scanner
B Then I'll put in the purchase request this week.
A Last, next week's time off. Two people are out Thursday, so we'll have a gap in coverage.
C I'll cover Thursday morning. Grace, can you take the afternoon?
B Please leave handoff notes before you're out too. We need to know which tickets are urgent.
A We don't have a notes template, but I'll make a simple one. Three columns: in progress, waiting, and customers to watch.
C Customers to watch is personal info, so let's use ticket numbers instead of names.
A Agreed. Just the numbers, and people can look up details in the system.
B Then I'll build the template. I'll share it this week. @handover-form
C Also, weekend tickets pile up on Monday. What if we add one more person Monday morning?
A Monday until 10 a.m. is the busiest, so two people on it then makes sense.
C I'll join support on Monday mornings.
B I'll show refund numbers at the next meeting too.
A Thanks. I'll add both to the schedule.
A Okay, sounds good. I'll put that on the schedule.
`);
const w = anchorsOf(weeklyScript);

export const WEEKLY_PAST_MEETING: MidMeeting = {
  script: weeklyScript,
  headline: "Tickets are down, and we're tracing the wrong shipments and buying scanners",
  lead: [{ text: "273 tickets with a 36-minute average first response. We'll trace the two wrong shipments through the shipping list and buy barcode scanners.", topics: [1] }],
  topics: [
    {
      title: "Last week's ops numbers",
      hasAgenda: false,
      items: [
        { kind: "DECISION", content: "Add five more questions to the FAQ", at: w("faq") },
        { kind: "DECISION", content: "Add a barcode scan step at shipping and buy two scanners", at: w("scanner") },
        { kind: "ACTION_ITEM", content: "Pull the top five repeat questions and write them up", at: w("faq"), who: "B", dueIn: 4 },
        { kind: "ACTION_ITEM", content: "Ask logistics for the shipping list behind the two wrong shipments", at: w("misship"), who: "A", dueIn: 2 },
        { kind: "ACTION_ITEM", content: "Submit the scanner purchase request", at: w("scanner"), who: "B", dueIn: 5 },
        { kind: "ACTION_ITEM", content: "Create and share a support handoff notes template", at: w("handover-form"), who: "B", dueIn: 4 },
        { kind: "STATUS_REPORT", content: "Last week had 273 tickets, down 8% from the week before", at: w("inquiry") },
      ],
      sentences: [
        { text: "Tickets are down, and we're expanding the FAQ.", items: [6, 0] },
        { text: "We'll trace the wrong shipments through the shipping list and bring in scanners.", items: [1, 3] },
      ],
    },
  ],
};

/** 브랜드 리뉴얼 방향 논의. 화자 A 이하린, B 최민재, C 강태오(외부 디자인). */
const brandScript = parseScript(`
A Let's start with the direction for the brand refresh. The key question is how much we change the logo and colors.
B I'd rather refine what we have and keep its strengths than change everything. Our brand recognition isn't that low.
C From the outside, the current logo's letters are thin, so it's hard to read at small sizes. Especially app icons and Instagram profiles.
A Agreed. It bugs me too that you can't read it small. So we make the letters bolder?
C Bolder, and you could also round the corners slightly. That keeps the soft feel you have now. @logo-direction
B And color? Our main color is a light purple, and the contrast is weak on screen.
C The safe move is one shade darker in the same family. A totally different color would feel unfamiliar to existing customers. @color-direction
A So for both logo and color, we keep the current look and make it easier to read.
B With this direction there's less work, so we can pull the timeline in.
A What timeline are you thinking?
C I can deliver the first drafts in two weeks. Two logo options and two color palettes. @schedule
A Great. When the drafts come in, we'll vote internally first and show a few customers too.
B Customer feedback overlaps with the interview schedule, so we could show them in the last 10 minutes.
A Please work that out with whoever's running the interviews.
B Sure, I'll talk to them.
A How much should the guide cover? Logo usage, color, fonts?
C Usually you'd add photo style and voice too. That keeps marketing consistent.
B I can put together the voice section. Including our rules for casual versus formal tone.
A Then the guide covers five things: logo, color, fonts, photo style, and voice. @guide-scope
C Got it. I'll send an outline first.
A What about cost? You gave us a quote at the start.
C Logo and guide together come to $5,500. If the scope stays as we just discussed, that holds. @budget
B What about materials with the old logo? Business cards, packaging?
C Once the new logo is final, you can use up the old stock, but anything newly printed should switch.
A We have two months of packaging left. We'll switch to the new logo after that.
B Online, it's better to switch all at once. Social profiles and the app icon should change on the same day.
A Right. Let's pick one switch day and change everything together. @switch-day
C I'll have announcement copy ready for the switch day.
B How do we tell existing customers the logo changed?
A It's not a big announcement. One line at the end of the newsletter is enough.
B Got it.
A Okay. We'll place the formal order after we review the drafts.
`);
const b = anchorsOf(brandScript);

export const BRAND_MEETING: MidMeeting = {
  script: brandScript,
  headline: "Logo and color keep the current look and get easier to read",
  lead: [{ text: "Bolder letters with rounded corners, and the main color goes one shade darker. First drafts arrive in two weeks.", topics: [1] }],
  topics: [
    {
      title: "Refresh direction",
      hasAgenda: false,
      items: [
        { kind: "DECISION", content: "Make the logo letters bolder with rounded corners so it reads at small sizes", at: b("logo-direction") },
        { kind: "DECISION", content: "Take the main color one shade darker in the same family", at: b("color-direction") },
        { kind: "DECISION", content: "Build the guide around five parts: logo, color, fonts, photo style, and voice", at: b("guide-scope") },
        { kind: "DECISION", content: "Switch the logo everywhere online on one set day", at: b("switch-day") },
        { kind: "ACTION_ITEM", content: "Deliver first drafts: two logo options and two color palettes", at: b("schedule"), who: "C", dueIn: 14 },
        { kind: "ACTION_ITEM", content: "Write up the voice guidelines", at: b("guide-scope"), who: "B", dueIn: 10 },
        { kind: "ACTION_ITEM", content: "Check with the interview lead about showing drafts at the end of interviews", at: b("schedule"), who: "B", dueIn: 7 },
        { kind: "STATUS_REPORT", content: "The quote for logo and guide together is $5,500", at: b("budget") },
      ],
      sentences: [
        { text: "We'll keep the current look while making it easier to read.", items: [0, 1] },
        { text: "Drafts come in two weeks, and the order goes in after we review them.", items: [4, 7] },
      ],
    },
  ],
};
