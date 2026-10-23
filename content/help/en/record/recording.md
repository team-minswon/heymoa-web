---
title: Recording and your microphone
description: How to start and pause a meeting recording, allow microphone access, and what to do when the connection drops.
group: record
slug: recording
order: 1
modified: 2026-10-23
---

## Start recording {#start}

1. **Create a meeting**
   Click **[New note]**, enter a meeting name, and click **[Create]**. Skip this if the note already exists.
2. **Click the red dot button**
   It's the **[Start meeting]** button at the bottom center of the note. In a paused meeting it becomes **[Resume]**. Any workspace member can start or resume a meeting.
3. **Allow microphone access**
   Your browser asks for microphone permission. Once you allow it, the **[Transcript]** tab opens and your words are transcribed.

::clip{name="new-meeting-record" alt="Clicking New note, entering a meeting name and creating it, then clicking the red dot button as speech is transcribed line by line in the transcript" caption="Creating a meeting and starting to record, with speech being transcribed. The browser's microphone permission prompt isn't shown in the clip."}

In the browser, HeyMoa records only your microphone. To also record the other people on a video call, use the [Desktop app](help:desktop). The same tip appears above the record button.

On the web you can't choose a microphone device. While recording, a bar shows how loud the microphone input is.

> [!Can't be undone]
> ==You can't record again in a meeting that has ended.==

## Pause and resume {#pause}

While recording, the dock (the control bar at the bottom) shows a ⏸ **[Pause]** button, the elapsed time, and the microphone input. **[Pause]** only pauses the recording. It doesn't end the meeting. Any audio not yet sent to the server is sent when you pause.

If you leave a meeting paused, we email you after 1 business day. If it's still paused after 3 business days, the meeting ends automatically and analysis starts. The scheduled time is shown in the notice at the top of the note.

![A note being recorded, with lines being transcribed in the transcript and the elapsed time and Pause button highlighted in the dock at the bottom](img:recording/dock.webp "The dock while recording. Click [Pause] to pause and [Resume] to continue.")

To finish the meeting, pause the recording and click **[End meeting]**. See [Ending a meeting and analysis](help:meeting-end) for details.

If another note is recording, **[Now recording]** appears at the top center of the screen. Click it to go to that note's **[Details]** tab. Click the ⏸ icon next to it to pause that recording.

## One recording place at a time {#one-place}

A meeting records in one place only. If it's recording in another tab or on another device, the start button is replaced by “Recording in another tab or on another device.”

You can take over a recording from a tab you refreshed or closed. When another tab takes over, the old tab shows “Another tab or device took over this recording.” and its recording ends.

> [!Note]
> If the device that was recording loses its connection, ==you can continue recording somewhere else after about 1 minute.==

## The connection dropped {#connection}

Find the message on your screen and follow the steps.

:::problem
**Symptom:** You see “Your microphone disconnected. Audio during this time isn't recorded.”
**Cause:** The microphone was disconnected or muted.
**Fix:** Check that the microphone is connected and not muted.
:::

:::problem
**Symptom:** You see “Connection lost. Transcription and live analysis paused. Recording is being saved on this device.”
**Cause:** Your internet connection dropped. Audio is still being saved on this device.
**Fix:** Keep this tab open until the connection comes back. HeyMoa then sends the saved audio to the server.
:::

:::problem
**Symptom:** You see “Transcription paused for a moment.”
**Cause:** The transcription connection paused briefly. Audio is still being saved.
**Fix:** Wait for it to recover.
:::

:::problem
**Symptom:** You see “Recording stopped because the connection was lost for too long.”
**Cause:** The connection was down for a long time, so the meeting was paused.
**Fix:** Click **[Resume]** to continue recording.
:::

If that doesn't solve it, look up your message in [Troubleshooting](help:troubleshooting).

## Frequently asked questions {#faq}

### Can I keep recording in a meeting that has ended?
No. You can't record again in a meeting that has ended. Create a new meeting instead.

### Can I record on two devices at once?
No. A meeting records in one place only. If the device that was recording loses its connection, you can continue recording somewhere else after about 1 minute.

### Does it record the other people's voices too?
In the browser, HeyMoa records only your microphone. To record a video call, use the desktop app.

## Related pages {#related}

- [Desktop app](help:desktop) — Record your computer's audio too
- [Ending a meeting and analysis](help:meeting-end) — What to do after recording
- [Troubleshooting](help:troubleshooting) — Fixes for each on-screen message
