---
title: Meeting context and custom vocabulary
description: Describe the meeting's topic and background, and add product names and acronyms to custom vocabulary, so AI meeting notes transcribe more accurately.
group: record
slug: terms-context
order: 3
modified: 2026-11-05
---

## Write the meeting context {#context}

In the **[Details]** tab, fill in **[Topic]** (200 characters) and **[Background]** (1,000 characters) under **[Meeting context]**. HeyMoa uses them while transcribing. The project name, meeting title, and attendee names are included automatically, so you don't need to write them.

::clip{name="context-autosave" alt="Typing a topic and background in the meeting context, which save automatically" caption="Meeting context saves automatically when you stop typing."}

It saves shortly after you stop typing, and also when you leave the field. “Saving…” changes to “Saved.” If saving fails, you see “Couldn't save” and a button to try again.

If you edit it while recording, you see “Recording. Your edits apply when recording resumes.” In an ended meeting it's read-only.

## Add terms to custom vocabulary {#dictionary}

Custom vocabulary is a glossary for transcription. Add product names, internal terms, and English acronyms that transcription often gets wrong. Go to **[Settings]** → **[Workspace]** → **[Custom vocabulary]**. Custom vocabulary applies to every meeting in the workspace, and any member can add or delete terms. There's no per-project vocabulary.

::clip{name="dictionary-batch" alt="Pasting several comma-separated terms into custom vocabulary and adding them at once" caption="Pasting several terms and adding them at once."}

1. **Enter terms in [Terms to add]**
   You can paste several at once, separated by commas, line breaks, semicolons, or tabs. You can add up to 100 at a time. Press `kbd:Shift+Enter` for a new line.
2. **Check the preview**
   Each term appears below the field. Terms that won't be added are marked **[duplicate]**, **[over 40 characters]**, or **[over limit]**.
3. **Press `kbd:Enter` to add them**
   Find added terms with **[Find a term]**, and delete one with the ✕ next to it.

Click **[Try an example]** to see the input format. When you reach the limit, delete a term before adding more.

> [!Caution]
> ==Each term can be up to 40 characters, and a workspace holds up to 200 terms.== ==You can't edit a term once it's added.== Delete it and add it again.

Custom vocabulary is a hint HeyMoa uses while transcribing. Terms in it can still be transcribed wrong. If you have too many terms and too much context, terms near the end may be left out because of the character limit for what can be sent to transcription. You don't need to add common words.

## Frequently asked questions {#faq}

### Can each project have its own custom vocabulary?
No. A workspace has one custom vocabulary, and it applies to every meeting in that workspace.

### Can I edit a term I added?
No. You can't edit a term once it's added. Delete it and add it again.

### Does adding a term mean it's always transcribed correctly?
No. Custom vocabulary is a hint used while transcribing, so terms in it can still be transcribed wrong.

## Related pages {#related}

- [Technical terms keep coming out wrong](help:fix-terms) — Step-by-step guide
- [Attendees and speakers](help:speakers) — Attendee names are hints too
