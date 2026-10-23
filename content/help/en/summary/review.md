---
title: Reviewing and confirming the summary
description: How to check and edit the decisions and tasks AI sorted out, then add them to the project. Nothing goes to the project until you confirm.
group: summary
slug: review
order: 2
modified: 2026-10-23
---

## The review screen {#screen}

When analysis finishes, the **[Summary]** tab opens **[In review]**. The **[Summary]** view has an overview, a **[When it was decided]** section, topics, decisions, and tasks. The **[Graph]** view also shows how topics relate, along with issues, questions, and notes.

![The Summary tab in review, with the summary overview and topic list and the review bar at the bottom](img:review/proposals.webp "The review screen. Click [Finish review] in the bar at the bottom to confirm.")

Topics that continue from an earlier meeting in the same project get a “Continued from …” link. Click it to open that meeting's **[Summary]** tab.

> [!Note]
> Links to earlier meetings are made before anyone reviews them, so they can be wrong.

## Edit and add items {#edit}

1. **Click an item to see its source**
   The source remarks expand. Click a remark to jump to that line in the transcript.
2. **Edit or exclude it**
   In an expanded item, use **[Edit]**, **[Exclude]**, or **[Undo exclude]**. Excluded items are left out when you confirm. In **[Edit]**, press `kbd:Enter` to save, `kbd:Esc` to cancel, and `kbd:Shift+Enter` for a new line.
3. **Add your own**
   Click **[Add decision]** or **[Add task]** below a section. Items you add are marked **[Added manually]**, and items you edit are marked **[Edited]**.
4. **Set an assignee and due date**
   On a task, click **[Set assignee]** and **[Set due date]**. You can set these only on tasks, issues, and questions.

If a task is assigned to an unnamed speaker, use **[Name speaker]** to set who the assignee is.

Any workspace member can edit and confirm a review. If someone else edited it first, you see “The review was changed.” Reload, then save.

## Choose what to do with AI suggestions {#suggestions}

AI makes two kinds of suggestions. To confirm, you need to choose what to do with each one.

- **[Earlier decision]**: Asks whether to replace a decision already confirmed in the project with the new one. Under “What should happen to the earlier decision?”, choose **[Replace]** or **[Keep]**. A decision that has already ended is marked “Already ended.”
- **[Change existing task]**: Suggests changing the status, assignee, or due date of a task that already exists. Choose **[Apply]** or **[Skip]**.

> [!Caution]
> When you choose **[Apply]**, it changes to **[Will apply]**, and the change is made to the task when you click **[Finish review]**. The change is kept in the task's history, and ==you can't undo an applied change.==

## Finish the review and confirm {#confirm}

1. **Check the bar at the bottom**
   It tells you “Add N decisions · N tasks.” If any suggestions are still unchosen, you're blocked with **[N suggestions to review]**. Click **[Go to suggestions]** to get to them.
2. **Click [Finish review]**
   A confirmation appears.
3. **Click again in the confirmation**
   The included items are confirmed in the project.

::clip{name="review-confirm" alt="Expanding items on the review screen to check their sources, then clicking Finish review to confirm" caption="Expanding items to check their sources and confirming with [Finish review]."}

After you confirm, the included tasks become project tasks and appear on the **[Tasks]** screen. Decisions, issues, and questions are kept as records in the project.

> [!Can't be undone]
> ==After you confirm, you can't edit, exclude, or add review items. You also can't undo the confirmation.== But you can still edit the tasks it created on the **[Tasks]** screen.

You confirm only once. If you see “The project's approval rules changed. Please reload.”, reload the screen and confirm again.

Nothing goes to the project until you click **[Finish review]**.

## Frequently asked questions {#faq}

### Can I make changes after confirming?
No. After you confirm, you can't edit the review items. You can still edit the tasks it created on the **[Tasks]** screen.

### Can I confirm without choosing on the suggestions?
No. You can't confirm until you choose on every suggestion. Use **[Go to suggestions]** to go through them one by one.

### Can other members edit the review?
Yes. Any workspace member can edit and confirm a review.

## Related pages {#related}

- [Ending a meeting and analysis](help:meeting-end) — How the summary is created
- [Tasks](help:tasks) — Manage tasks created by confirming
- [I want to check the summary and confirm it](help:confirm-summary) — Steps through to confirmation
