---
title: My agent
description: Ask your agent about past meetings and choose where it searches. It only creates or changes tasks after you approve.
group: team
slug: agent
order: 2
modified: 2026-10-23
---

## Open your agent {#open}

Click the **[My agent]** button in the bottom-right corner. The first time, an intro card appears. Click **[Open it]** to start, or **[Don't show again]** to close it.

When you view a note in full screen, the agent opens in the right panel and uses the current meeting as its search scope. You can't use the agent in the side view that opens next to the notes list. Only you can see your conversations.

## Ask a question {#ask}

1. **Click a card or type a question**
   In an empty conversation, click **[Search meeting notes]**, **[Create a task]**, **[Connect to other tools]**, or **[Search the web]** to send that question right away.
2. **Set the search scope**
   Type `@` in the input box to pick projects and meeting notes. You can add up to 20.
3. **Send it**
   Press `kbd:Enter` to send and `kbd:Shift+Enter` for a new line.

![The My agent panel with a question about the May budget and an answer with sources](img:agent/chat.webp "The My agent panel. Type @ in the input box to add projects and meeting notes.")

::clip{name="agent-ask" alt="Opening a new conversation in My agent, clicking Search meeting notes, and the answer streaming in" caption="Asking your agent about a past meeting."}

It also answers questions like “my tasks”, “tasks with no assignee”, “overdue tasks”, or “how much of this meeting is left to review”.

When you open the agent from a note, that meeting's notes are added to the scope automatically. To ask about decisions and tasks confirmed in a project, add the project too.

**[+]** starts a new conversation, and **[History]** lists past ones. You can't delete or rename conversations. Each conversation is titled after its first question.

> [!Note]
> When a conversation gets very long, the earlier part is summarized and collapsed. Repeat any important context in your new question.

## How answers are made {#answers}

The agent first searches and reads meeting notes, transcripts, and the decisions and tasks confirmed in projects, then answers. **[Referenced meeting notes]** under an answer lists the meeting notes it actually read for that answer. It doesn't cite a source for each sentence.

If it can't find anything, it says so and tells you how far it searched. If a decision has changed, it shows the current decision separately from the earlier one. It's still an AI answer, so check anything important against the meeting notes.

**[Search the web]** is only for outside information that isn't in your meetings. Results from the web are shown with source links, kept apart from meeting content.

> [!Note]
> ==You can't send a new message while an answer is being written or while an approval is pending.== Click **[Stop]** to stop and keep the answer so far.

## Changes happen only after you approve {#approve}

You can ask the agent to do these things:

- Create meeting notes or rename them
- Create and edit tasks
- Change attendees and assign speakers
- Add and edit review items
- Mark notifications as read
- Send meeting result emails

It doesn't confirm reviews or start recordings. Do those yourself on screen.

1. **Check the approval card**
   It shows each change as before → after.
2. **Click [Approve] or [Reject]**
   The card doesn't expire until you decide.

If you reject, the agent doesn't run the action or retry it. It tells you only what it couldn't do. If someone else changed the same value after you approved, your approved value overwrites it and the agent tells you.

The card badge moves through **[Awaiting approval]**, **[Running]**, **[Done]**, **[Rejected]**, and **[Failed]**.

- **[Void]**: The conversation ended before you approved.
- **[Needs check]**: The agent couldn't confirm whether the action ran. Check on screen whether the change was applied. It doesn't retry automatically.

> [!Can't be undone]
> Meeting result emails can only go to workspace members. ==You can't recall an email once it's sent.== There's also a daily limit on how many you can send.

Creating and editing Linear issues and creating GitHub issues only work in workspaces with those integrations set up. See [Integrations](help:integrations) to connect them.

## When no answer comes {#errors}

:::problem
**Symptom:** “The response took too long and was stopped.” appears
**Cause:** The answer went over the time allowed for one request.
**Fix:** Split your question into smaller ones and send them again.
:::

:::problem
**Symptom:** “Too many requests right now, so the answer couldn't start. Please send it again in a moment.” or “The server was updated and the response stopped. Please send it again.” appears
**Cause:** The server is busy or being updated.
**Fix:** Send the same question again. It isn't resent automatically.
:::

:::problem
**Symptom:** “An answer is already being written.” appears
**Cause:** An earlier question in the same conversation is still being processed.
**Fix:** Wait for it to finish, or click **[Stop]**.
:::

## Frequently asked questions {#faq}

### Can other people see my conversations?
No. Only you can see your conversations.

### Can the agent confirm a review or start a recording for me?
No. It doesn't confirm reviews or start recordings. Do those yourself on screen.

### Do approval cards disappear after a while?
No. They wait until you approve and don't expire.

## Related pages {#related}

- [Integrations](help:integrations) — The connections you need to create issues
- [I want to find a past decision](help:find-decisions) — Steps for finding decisions with your agent
- [Tasks](help:tasks) — Check the tasks your agent created
