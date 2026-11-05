---
title: Ending a meeting and analysis
description: When you end a meeting, AI sorts out the summary, decisions, and tasks. Learn how to end it, the analysis steps, and what to do if it's slow or fails.
group: summary
slug: meeting-end
order: 1
modified: 2026-11-05
---

## End a meeting {#end}

You can't click the end button while recording. Pause recording first. A meeting that hasn't started yet can't be ended.

1. **Click [Pause]**
   When you pause, “Recording paused. Wrap up now?” appears below the button for 15 seconds. Choose **[End now]**, **[Later]**, or **[Don't show again]**.
2. **Click [End meeting] at the top**
   A confirmation shows the participants' names and the recording status.
3. **Check the participants**
   If there are fewer than 2 participants, you see a warning. Click **[Go to participants]** to go back and set them.
4. **Click [End meeting] in the confirmation**
   You're taken to the **[Summary]** tab.

::clip{name="pause-end-nudge" alt="Clicking the Pause button in the dock while recording, the status changing to Paused, and a bubble below the End meeting button asking whether to wrap up" caption="When you pause, a wrap-up prompt appears below [End meeting]."}

Any workspace member can end a meeting. ==You can't record again in a meeting that has ended.==

Before the meeting ends, the **[Summary]** tab explains the steps: creating the summary, identifying speakers, then reviewing and confirming.

## What happens after it ends {#analysis}

When you end a meeting, summary creation starts automatically. It doesn't wait for speaker identification to finish, so ==the summary can be ready before speakers are identified.==

The **[Summary]** tab shows four steps: **[Organize meeting]**, **[Check conflicts and assignees]**, **[Review]**, and **[Confirm]**. It's usually ready within 1 minute after the meeting ends. But it can take a few minutes. You can move to another screen meanwhile, and the transcript stays available.

Assignees and due dates are filled in separately after speaker identification finishes. Items someone has already edited aren't overwritten. If speaker identification fails, you review without suggested assignees and due dates.

> [!Note]
> For a moment right after the meeting ends, it may show “Analyzing the meeting.” When the analysis is done, the person who requested it gets a [notification](help:account#notifications).

## When analysis doesn't finish or fails {#failed}

:::problem
**Symptom:** You see “Waiting for analysis” and a **[Request analysis]** button
**Cause:** Some time has passed since the meeting ended, but analysis hasn't been requested yet.
**Fix:** Click **[Request analysis]**.
:::

:::problem
**Symptom:** You see “Couldn't analyze the meeting”
**Cause:** Analysis didn't finish within 12 minutes, or its result couldn't be accepted.
**Fix:** Click **[Regenerate]**. Any workspace member can do this. The transcript and meeting record stay as they are.
:::

If you still don't see a summary, also try [The meeting ended but there's no summary](help:summary-missing).

## What the summary contains {#summary}

A summary has four parts.

- One-line title: The meeting in a single sentence.
- One-line summary per topic: Each topic comes with an explanation, a conclusion, and what's left open.
- Decisions: Decisions from the whole meeting.
- Tasks: Tasks from the whole meeting.

The summary is built from the items sorted out live during the meeting. Each sentence links to the items it's based on. Because AI wrote it, check anything important by clicking the source remark.

To check and edit it, see [Reviewing and confirming the summary](help:review).

## Frequently asked questions {#faq}

### Who can end a meeting?
Any workspace member can end a meeting.

### Can the summary be ready before speakers are identified?
Yes. Summary creation starts right away without waiting for speaker identification to finish.

### If analysis fails, is the recording lost?
No. The transcript and meeting record stay as they are. Click **[Regenerate]**.

## Related pages {#related}

- [Reviewing and confirming the summary](help:review) — Edit the summary and add it to the project
- [The meeting ended but there's no summary](help:summary-missing) — What to check when the summary is missing
- [Attendees and speakers](help:speakers) — Set participants and name speakers
