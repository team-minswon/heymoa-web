---
title: Meeting context and glossary
description: Describe the meeting's topic and background, and add product names and acronyms to the glossary, so AI meeting notes transcribe more accurately.
group: record
slug: terms-context
order: 3
modified: 2026-10-21
---

## Write the meeting context {#context}

In the **[Details]** tab, fill in **[Topic]** (200 characters) and **[Background]** (1,000 characters) under **[Meeting context]**. HeyMoa uses them while transcribing. The project name, meeting title, and attendee names are included automatically, so you don't need to write them.

::clip{name="context-autosave" alt="Typing a topic and background in the meeting context, which save automatically" caption="Meeting context saves automatically when you stop typing."}

It saves shortly after you stop typing, and also when you leave the field. “Saving…” changes to “Saved.” If saving fails, you see “Couldn't save” and a button to try again.

If you edit it while recording, you see “Changes apply when recording resumes.” In an ended meeting it's read-only.

## Add words to the glossary {#dictionary}

Add product names, internal terms, and English acronyms that transcription often gets wrong. Go to **[Settings]** → **[Workspace]** → **[Glossary]**. The glossary applies to every meeting in the workspace, and any member can add or delete words. There's no per-project glossary.

::clip{name="dictionary-batch" alt="Pasting several comma-separated words into the glossary and adding them at once" caption="Pasting several words and adding them at once."}

1. **Enter words**
   You can paste several at once, separated by commas, line breaks, semicolons, or tabs. You can add up to 100 at a time. Press `kbd:Shift+Enter` for a new line.
2. **Check the preview**
   Below the field you see **[Already added]**, **[Over 40 characters]**, or **[Over limit]**.
3. **Press `kbd:Enter` to add them**
   Find added words with **[Find a word]**, and delete one with the ✕ next to it.

Click **[Try an example]** to see the input format. When you reach the limit, delete a word before adding more.

> [!Caution]
> ==Each word can be up to 40 characters, and a workspace holds up to 200 words.== ==You can't edit a word once it's added.== Delete it and add it again.

The glossary is a hint HeyMoa uses while transcribing. Words in it can still be transcribed wrong. If you have too many words and too much context, words near the end may be left out because of the character limit for what can be sent to transcription. You don't need to add common words.

## Frequently asked questions {#faq}

### Can each project have its own glossary?
No. A workspace has one glossary, and it applies to every meeting in that workspace.

### Can I edit a word I added?
No. You can't edit a word once it's added. Delete it and add it again.

### Does adding a word mean it's always transcribed correctly?
No. The glossary is a hint used while transcribing, so words in it can still be transcribed wrong.

## Related pages {#related}

- [Technical terms keep coming out wrong](help:fix-terms) — Step-by-step guide
- [Attendees and speakers](help:speakers) — Attendee names are hints too
- [Limits and rules](help:limits) — 200 words, 40 characters
