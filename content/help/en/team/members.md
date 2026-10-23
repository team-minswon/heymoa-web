---
title: Members and guest participants
description: Invite members to your workspace and change their roles and display names. You can also manage guest participants, who join meetings by name without an account.
group: team
slug: members
order: 3
modified: 2026-10-23
---

## Invite members {#invite}

Only admins can invite. There are just two roles: **[Admin]** and **[Member]**.

1. **Open Members in Settings**
   Go to **[Settings]** → **[Workspace]** → **[Members]**.
2. **Enter an email in the [Invite members] section**
   Use the email address of the person you're inviting.
3. **Choose a role**
   Pick **[Member]** or **[Admin]**.
4. **Click [Invite]**
   An email goes to that address.

::clip{name="members-invite" alt="Entering a coworker's email in the Members tab of Settings and inviting them, so they appear in Pending invites" caption="Enter an email and click [Invite]. It appears in [Pending invites]."}

> [!Caution]
> ==An invite link is valid for only 1 day after it's sent.== You can't send a new invite to an address that already has a pending one. Click **[Cancel]** in **[Pending invites]**, then invite again. There's no way to resend an invite.

There's a daily limit on how many invites you can send. If you go over it, you'll see “Invites can't be sent right now. Please try again later.”

The invited person clicks **[Accept]** or **[Decline]** from the notification bell at the top. They can also use the link in the invite email. They need to sign in with the Google account for the invited email. Workspace invites are the only kind of notification.

## Change roles and display names {#manage}

Only admins can change the role in a member's row. If there's only one admin, ==you can't change that admin to a member or remove them.== That admin also can't leave the workspace. You'll see “A workspace must have at least one admin.”

To change a display name:

1. **Click [⋯] in the row**
   A menu opens.
2. **Choose [Rename]**
   The **[Name shown in this workspace]** field appears.
3. **Enter a name**
   You can use up to 30 characters. If you leave it blank, the account name is shown.

![The rename window for a member, with the Name shown in this workspace field and a hint below it](img:members/rename.webp "A hint explains that the account name is shown if you leave it blank.")

You can change your own name, and admins can change anyone's. The new name shows up right away for attendees, speakers, and task assignees. Summaries that were already written don't change.

Your account name and email are shown in **[Settings]** → **[Account]** → **[My account]**, where you can view them but not change them.

Only admins can use **[Remove]**. Removing someone also disconnects the Linear and GitHub integrations and the outside AI app connections they set up.

**[Leave workspace]** is at the bottom of the Members tab. Type the workspace name exactly in the confirmation window to leave. You can't leave while you're recording in this workspace.

## Manage guest participants {#guests}

A guest participant is someone who appears in a meeting by name without an account. You add them with **[Add participant]** in the Details tab or from the speaker assignment menu. Names can be up to 100 characters. See the list in **[Settings]** → **[Workspace]** → **[Guest participants]**.

Only admins see the **[⋯]** menu at the end of each row. Use it to **[Rename]**, **[Link to account]**, or **[Delete]**. **[Link to account]** shows how many meetings will change before you go ahead.

> [!Can't be undone]
> ==Linking and deleting can't be undone.== Deleting a guest participant also removes their participation records and speaker assignments.

## Frequently asked questions {#faq}

### Can I resend an invite link?
No. There's no way to resend. Click **[Cancel]** in **[Pending invites]**, then invite again.

### I'm the only admin. Can I leave?
No. A workspace must have at least one admin. Make another member an admin, then leave.

### Can members change their own display name?
Yes, you can change your own name. Only admins can change other people's names.

## Related pages {#related}

- [I want to invite teammates to work together](help:invite-team) — Steps from inviting to your first meeting
- [Attendees and speakers](help:speakers) — How to add guest participants to a meeting
- [Integrations](help:integrations) — Connections that are removed when you remove a member
