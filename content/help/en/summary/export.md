---
title: Copy, export to PDF, and email
description: How to copy meeting notes and transcripts, download them as a PDF, and email them to attendees, plus the recipient and file size limits.
group: summary
slug: export
order: 3
modified: 2026-10-26
---

## Copy {#copy}

Click **[Copy]** at the top of the summary and choose a format.

- **[Copy as text]**: Copies plain text without symbols.
- **[Copy as Markdown (.md)]**: Markdown is a text format that marks headings and lists with symbols. It pastes well into Notion, Obsidian, and LLMs (conversational AI).

**[Copy]** in the transcript copies it as Markdown. The copy icon on the timeline copies the whole timeline.

## Export to PDF {#pdf}

1. **Click [Share] in the summary**
   A menu opens.
2. **Choose [Export as PDF]**
   The meeting notes (key summary, decisions, tasks, and open items) are always included.
3. **Decide whether to include the transcript**
   Turn on the **[Transcript]** switch to include it. The switch starts off each time you open the window.
4. **Click [Download PDF]**
   The PDF is created and starts downloading.

## Send by email {#mail}

1. **In [Share], choose [Send by email]**
   The **[Send meeting notes]** window opens.
2. **Choose what to send under [Content]**
   Meeting notes are the default. Add **[Transcript]** to send the transcript too.
3. **Fill in [To]**
   Click **[Add all attendees]** or type addresses. Separate addresses with a comma or `kbd:Enter`. Addresses outside the workspace are fine.
4. **Add a message if you like**
   The message is optional and can be up to 1,000 characters.
5. **Send the email**
   The email goes to the recipients.

::clip{name="export-mail" alt="Opening Send by email from the Share menu, adding all attendees, sending, and seeing the result" caption="Filling in recipients with [Add all attendees], sending, and checking the result."}

Recipients get an email titled “[Meeting notes] meeting title” with the PDF attached. The meeting notes are only in the attachment, not in the email body. Replies go to the sender.

> [!Note]
> You can send to up to 10 people at once, and the PDF must be 10 MB or smaller. Each person can send up to 30 times an hour. ==PDFs sent by email are kept for 30 days.==

## Check the result {#result}

Each recipient shows **[Sending]**, **[Sent]**, or **[Not sent]**. If some weren't sent, click **[Resend to N not sent]**.

**[Sent]** means the mail server accepted the email. It doesn't guarantee the email reached the recipient's inbox.

If some speakers have no name, a warning says they'll go out unnamed. It helps to name speakers before you send.

:::problem
**Symptom:** You see “You've sent too many emails. Try again in a moment.”
**Cause:** You went over the number of emails one person can send in an hour.
**Fix:** Wait a while, then send again.
:::

## Frequently asked questions {#faq}

### Can I send to people outside the workspace?
Yes. You can send to addresses outside the workspace.

### Are the meeting notes in the email body?
No. The meeting notes go only as the attached PDF, not in the body.

### Can I send the transcript too?
Yes. Add **[Transcript]** under **[Content]**. When you export to PDF, turn on the **[Transcript]** switch.

## Related pages {#related}

- [Reviewing and confirming the summary](help:review) — Fix the summary before you send it
- [Attendees and speakers](help:speakers) — Name unnamed speakers
