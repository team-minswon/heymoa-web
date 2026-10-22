---
title: Troubleshooting
description: Fixes for each on-screen message when recording won't start, the connection drops, the summary doesn't appear, or an invite link doesn't work.
group: fix
slug: troubleshooting
order: 1
modified: 2026-10-23
---

## Recording won't start {#recording}

:::problem
**Symptom:** “Microphone permission is required” appears
**Cause:** The browser isn't allowed to use the microphone.
**Fix:** Allow the microphone in your browser's site settings. Then click the record button again.
:::

:::problem
**Symptom:** “No available microphone was found” appears
**Cause:** There's no microphone available.
**Fix:** Check that a microphone is connected.
:::

:::problem
**Symptom:** “Recording couldn't start, so the session expired. Please try again.” appears
**Cause:** It didn't connect within 1 minute of starting.
**Fix:** Click the record button again.
:::

:::problem
**Symptom:** The **[End meeting]** button doesn't respond
**Cause:** You can't click this button while recording.
**Fix:** Click **[Stop]**, then click **[End meeting]**.
:::

## Can't connect {#connection}

:::problem
**Symptom:** “Couldn't connect to the live transcript server” appears
**Cause:** There may be a problem with your sign-in or your internet connection.
**Fix:** Check that you're signed in and connected to the internet. Then click the record button again.
:::

:::problem
**Symptom:** “This meeting is being recorded in another tab or on another device” appears
**Cause:** The same meeting is already being recorded in another tab or on another device.
**Fix:** Stop recording in that tab or on that device.
:::

:::problem
**Symptom:** “Lost connection to the recording device” appears
**Cause:** The connection to the device that was recording was lost.
**Fix:** ==Try again in about 1 minute, once that device's recording has been closed out.==
:::

:::problem
**Symptom:** “Recording stopped because the connection was lost” appears
**Cause:** The network connection dropped and recording stopped.
**Fix:** Check your network, then click **[Resume]** to keep recording.
:::

:::problem
**Symptom:** “The connection to the speech recognition service was interrupted. Please try again later.” appears
**Cause:** The connection to the speech recognition service was lost.
**Fix:** Wait a moment, then click **[Resume]** to keep recording.
:::

## The summary doesn't appear {#summary}

:::problem
**Symptom:** “Waiting for analysis” appears
**Cause:** Analysis hasn't been requested yet.
**Fix:** Click **[Request analysis]**.
:::

:::problem
**Symptom:** “The meeting couldn't be analyzed” appears
**Cause:** Analysis failed.
**Fix:** Click **[Reanalyze]**. Your transcript and meeting record are still there.
:::

:::problem
**Symptom:** “Speakers couldn't be separated” appears
**Cause:** Speaker separation failed.
**Fix:** The summary is created without speakers. Add names yourself in the transcript.
:::

## Invite, delete, or permission messages {#workspace}

:::problem
**Symptom:** “This invite has expired” appears
**Cause:** The invite link is past its valid period.
**Fix:** ==Invite links are valid for only 1 day.== Ask an admin to invite you again.
:::

:::problem
**Symptom:** “This invite is for a different email account” appears
**Cause:** You signed in with an account other than the invited email.
**Fix:** Sign in with the Google account for the invited email.
:::

:::problem
**Symptom:** “Invites can't be sent right now. Please try again later.” appears
**Cause:** You went over the number of invites you can send in a day.
**Fix:** Send it again after some time has passed.
:::

:::problem
**Symptom:** “A project with notes can't be deleted.” appears
**Cause:** You can't delete a project that has even one note.
**Fix:** Only admins can delete projects. A project can't be deleted while it has any notes.
:::

:::problem
**Symptom:** “You don't have permission to change this workspace.” appears
**Cause:** You tried to change an admin-only setting from an account that isn't an admin.
**Fix:** Only admins can rename the workspace, manage integrations, and manage members. Ask an admin.
:::

## Still not fixed {#more}

For problems in the desktop app, see the troubleshooting section of [Desktop app](help:desktop#trouble). For number limits, see [Limits and rules](help:limits).

If that doesn't help, send a **[Problem or error]** request from **[Help & feedback]** in the sidebar. See [Help & feedback](help:feedback) for how to send one.

## Related pages {#related}

- [Limits and rules](help:limits) — Input lengths, rate limits, and expiration times
- [Desktop app](help:desktop#trouble) — Problems in the desktop app
- [Help & feedback](help:feedback) — How to reach us when nothing else works
