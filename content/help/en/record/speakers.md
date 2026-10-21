---
title: Attendees and speakers
description: How to set a meeting's attendees and mark who said what in the transcript. You can also fix the results of speaker separation.
group: record
slug: speakers
order: 2
---

## Set attendees {#attendees}

1. **In the [Details] tab, click [Add participant] under [Attendees]**
   Search by name or email and pick someone. You can pick workspace members and guest participants.
2. **Add someone who isn't on the list**
   Click **[+ Add “name”]**. They're added as an outside person for this meeting (a guest participant) without an account. Only a name is needed. You manage guests in [Members and guest participants](help:members#guests).

You can change attendees before, during, or after the meeting. Changes are saved when you close the window. The screen uses both “attendee” and “participant.” They mean the same thing.

> [!Note]
> ==Speaker separation is based on the number of participants at the moment the meeting ends.== People you add after that aren't included in this round of speaker separation. Attendee names also help transcription recognize what's said.

## Read the transcript {#transcript}

Speech builds up in the **[Transcript]** tab in real time. If you scroll up, a **[Jump to bottom]** button appears. Where recording was paused and resumed, you see “Paused at HH:MM and resumed at HH:MM.”

While recording, HeyMoa only transcribes and doesn't tell speakers apart. Speakers are separated after the meeting ends.

**[Copy]** above the transcript copies it as Markdown (a format that marks up text with symbols). In an ended meeting you see a toolbar with **[Search]**, **[Speakers]**, **[Unassigned N]**, and **[Copy]**.

In **[Search]**, `kbd:Enter` goes to the next result, `kbd:Shift+Enter` to the previous one, and `kbd:Esc` closes search. Search isn't available in the transcript before the meeting ends.

## Assign speakers {#assign}

When the meeting ends, HeyMoa separates the speakers. Meanwhile you see “Separating speakers. When it's done, you can tell us who's who.” It usually takes a few minutes. If speaker separation fails, the summary is still created, just without speakers.

1. **Click a speaker name**
   When separation is done, click a speaker name in the transcript.
2. **Choose the scope**
   Choose **[Apply to all of this speaker's lines]** (the default) or **[Apply to this line only]**. If you've changed some lines individually and then apply to all, a confirmation asks you, because those individual changes will be removed.
3. **Pick a person**
   Find them with **[Search by name]** and pick them. The choice applies right away to the scope you chose. If you don't know, pick **[Leave unnamed]**. If you pick a member who isn't an attendee, they're added as an attendee too. One person can be assigned to several speakers.

![Clicking a speaker name in the transcript opens the attendee list and the scope choice](img:speakers/assign-menu.webp "Click a speaker name to open the menu for picking an attendee.")

::clip{name="speaker-assign" alt="Clicking an unnamed speaker in the transcript and picking an attendee" caption="Clicking an unnamed speaker and picking an attendee."}

Click **[Unassigned N]** to jump to the next speaker nobody has identified yet. **[Speakers]** opens a panel that shows who spoke and for how long. In the speaker dock at the bottom of the screen, click a bar to jump to that moment.

Any workspace member can assign and change speakers.

> [!Can't be undone]
> **[Reset all assigned speakers]** at the bottom of the panel removes every name and individual assignment and sets everyone back to “Speaker A.” ==Once you reset, you can't bring back the earlier assignments.==

## Frequently asked questions {#faq}

### Are speakers separated while recording?
No. HeyMoa doesn't tell speakers apart while recording. Speakers are separated after the meeting ends.

### What happens to the summary if speaker separation fails?
The summary is created without speakers. Add names yourself in the transcript.

### Can I add attendees after the meeting ends?
Yes, you can add attendees after the meeting ends. But they aren't included in this round of speaker separation, which uses the number of participants at the moment the meeting ends.

## Related pages {#related}

- [Members and guest participants](help:members) — Manage guest participants
- [I want to fix a speaker's wrong name](help:fix-speakers) — Step-by-step guide
- [Ending a meeting and analysis](help:meeting-end) — When speaker separation starts
