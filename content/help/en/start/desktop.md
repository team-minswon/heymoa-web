---
title: Desktop app
navTitle: Install and use the app
badge: desktop
description: Install the Mac or Windows app, record the sound your computer plays as well as your microphone, and fix common problems.
group: start
slug: desktop
order: 4
modified: 2026-10-21
---

## How the web and the app differ {#overview}

The desktop app records your microphone and the sound your computer plays. The other people's voices in a video call are part of that computer sound. Recording continues even after you close the window. The screens are the same as the web service.

| | Web (browser) | Desktop app |
|---|---|---|
| Records your microphone | ✓ | ✓ |
| Records sound your computer plays | ✗ | ✓ |
| Keeps recording after you close the window | ✗ | ✓ |
| Installation | – | Required |

On Mac, you can install it on macOS 14.2 or later (Apple Silicon). The installers are on the [download page](/download).

## How to install {#install}

The app runs on macOS 14.2 or later (Apple Silicon) and on Windows 11 x64. On anything else, you see “Unsupported environment” and the app closes. Each operating system (OS) records computer sound differently, so the app runs only where it has been tested. In that case, use the web service in your browser. Only your microphone is recorded there.

::::tabs
:::tab{title="Mac"}
1. **Download the file from the [official release page](https://github.com/team-minswon/homebrew-tap/releases)**
   For an Apple Silicon Mac, it's the file whose name ends in `mac-arm64.dmg`.
2. **Move HeyMoa to the Applications folder**
   Open the downloaded DMG and drag HeyMoa into the folder.
3. **Open it for the first time**
   If you're asked to confirm opening an app downloaded from the internet, click **[Open]**. The Mac app is signed and notarized by Apple.

If you use Homebrew (an install tool for Mac), you can also install it by entering this command in Terminal.

```
brew install --cask team-minswon/tap/heymoa
```
:::
:::tab{title="Windows"}
1. **Download the file from the [official release page](https://github.com/team-minswon/homebrew-tap/releases)**
   It's the file whose name ends in `win-x64.exe`.
2. **Run the downloaded file**
   Installation starts.

> [!Note]
> The Windows installer isn't signed, so you may see a SmartScreen warning.
:::
::::

> [!Tip]
> To check that your download matches the official file, compare its SHA256 value with `SHA256SUMS` on the official release page. A SHA256 value is a check string that is different for every file.

## First launch and sign-in {#first-run}

When you open the app for the first time, the “Get started with HeyMoa” window appears. It guides you through setting up your microphone and computer sound. It doesn't record anything.

1. **Allow microphone access**
   Do this in the **[Your voice]** section. On Mac, click **[Allow microphone]**. If you denied access before, or you're on Windows, click **[Open settings]** to open the OS microphone settings. The status shows as “Allowed”, “Access needed”, or “Restricted on this device”.
2. **Allow computer sound access when you first record**
   When your Mac asks for access, allow it. You can also find it under Privacy & Security in System Settings. Depending on your macOS and app version, it's listed as “System Audio Recording” or “Screen & System Audio Recording”. On Windows, the app records whichever speakers or headset are playing sound right now.
3. **Check the access status again**
   When you change a setting and come back to the app, the status updates. To check it yourself, click **[Check again ↻]**.
4. **Start**
   If you allowed the microphone, click **[Get started with HeyMoa]**. If not yet, click **[Set up later and start]**. Once you finish, this window doesn't appear again.
5. **Sign in to the app as well**
   The app and the browser have separate sign-ins. Click the sign-in button and the sign-in screen opens in your default browser. When you finish, you're taken back to the app. If your browser asks whether to open HeyMoa, allow it.

If you don't sign in within 5 minutes, you see “Sign-in timed out”. Click the sign-in button again.

## Recording meetings in the app {#recording}

When you record in the app, both your microphone and the sound your computer plays are recorded. The other people's voices in a video call are part of that computer sound. The record button, **[Pause]**, **[Resume]**, and **[End meeting]** work the same as on the web.

However, we're still checking how well other people's voices are recorded in each app, such as Zoom and Webex.

If you see “Microphone disconnected” or “Computer sound disconnected” while recording, the sound during the gap isn't recorded. Check your device connection and whether anything is muted.

> [!Note]
> ==Clicking the window's close button doesn't quit the app. It only hides the window.== Recording continues. To open it again, click the HeyMoa icon in the menu bar (Mac) or the notification area of the taskbar (Windows).

## Using the menu bar and tray {#menubar}

::clip{name="desktop-menubar" alt="Clicking the menu bar icon opens a popover, decisions, tasks, and open questions pile up during recording, and pausing the recording returns it to standby" caption="Sample screen. Click the menu bar icon to open the current meeting's timeline."}

The icon in the menu bar (Mac) or the notification area of the taskbar (Windows) shows the recording status.

Click the icon to open the current meeting's timeline. Choose what to see from **[All]**, **[Decisions]**, **[Tasks]**, **[Open questions]**, and **[References]**. Click **[Open current meeting ↗]** to open the meeting screen, or **[⏸ Pause recording]** to pause recording.

If nothing new arrives for more than 30 seconds, you see “Updates paused”. Open the meeting to check on it.

When you're not recording, it opens as “Ready to record” and shows “No meeting is being recorded.” While you're viewing a meeting someone else is recording, the pause recording button becomes **[Stop viewing]**. On Mac, the time since recording started appears next to the icon while you record.

Right-click the icon and the first line of the menu shows the current status, for example “Recording · 12:34 since start”. The status names mean:

- **Waiting to send**: Some audio is still on your computer and hasn't been sent to the server yet.
- **Mic muted / System audio paused / System audio stopped**: Sound from that microphone or from your computer isn't being recorded right now.
- **Waiting to quit**: The app is finishing the recording and waiting to quit.
- **Recording status unknown**: Open the meeting screen to check the recording status.

## Pausing recording and quitting the app {#quit}

**[Pause recording]** only pauses recording. The meeting doesn't end, so you can keep recording later. To finish the meeting, click **[End meeting]** on the meeting screen.

If you choose **[Quit app]** from the menu or press `kbd:⌘Q` on Mac while recording or while some audio hasn't been sent, a confirmation window opens. The app doesn't quit right away.

1. **Choose [Stop recording and quit]**
   The app stops recording, sends all the audio, and then quits. If it isn't done after 30 seconds, you see a message.
2. **To cancel while you wait, click [Quit app] again**
   Then choose **[Cancel quit]**.

> [!Can't be undone]
> If you choose **[Discard audio and quit…]**, the app asks you once more and then quits right away. ==Audio that wasn't saved to the server can't be recovered.==

## Updating to a new version {#update}

There are no automatic updates. Check the [official release page](https://github.com/team-minswon/homebrew-tap/releases) for new versions. Most screens and features change along with the web right away. However, the app's own features, such as sound recording and the menu bar, change only when you install a new version.

1. **Pause recording**
   Don't update while recording.
2. **Quit the app**
   The app must be fully closed before you can install the new version.
3. **Install the new version**
   On Mac, copy HeyMoa from the new DMG into the Applications folder, replacing the old one. With Homebrew, run `brew upgrade --cask heymoa`. On Windows, run the new installer.

If you see “Update the app, then sign in again” when signing in, you need to update the app. Click **[See new version]** to get it.

## Problems in the app {#trouble}

:::problem
**Symptom:** You see “Couldn't start recording”
**Cause:** Usually the app doesn't have microphone or computer sound access.
**Fix:** On Mac, check the microphone and audio recording permissions under Privacy & Security. On Windows, check the microphone privacy page in Settings. If you just allowed access during your first recording, click the record button once more. If it still doesn't work, or macOS asks you to quit the app, fully quit the app and open it again. On Mac, closing the window only hides the app, so quit with **[Quit app]** in the menu or `kbd:⌘Q`. Recording doesn't restart on its own.
:::

:::problem
**Symptom:** The other people's voices aren't recorded
**Cause:** Their sound may not be playing on this computer.
**Fix:** Check that you can hear the sound on this computer. On Windows, also check the output device in Sound settings.
:::

:::problem
**Symptom:** You see “Sound capture stopped”
**Cause:** Recording stopped. This can happen if the app screen stops responding for a moment. The last bit of audio may be missing.
**Fix:** Start recording again from the meeting screen.
:::

:::problem
**Symptom:** You see “The app screen stopped”
**Cause:** The app screen froze. Audio that wasn't sent may be lost.
**Fix:** Click **[Reopen]**. Recording doesn't restart on its own, so start it yourself in the meeting.
:::

:::problem
**Symptom:** You see “Couldn't connect to HeyMoa”
**Cause:** Your internet connection is unstable.
**Fix:** Check your internet connection and click **[Try again]**.
:::

:::problem
**Symptom:** You can't sign in
**Cause:** If you see “Couldn't sign in”, the sign-in process was interrupted. If you signed in on the browser but the app hasn't changed, your browser may be asking whether to open HeyMoa.
**Fix:** Click the sign-in button again and allow your browser to open HeyMoa.
:::

> [!Note]
> We're still checking recordings made with Bluetooth headsets and recordings after your computer wakes from sleep. If you see a disconnection message while recording, pause recording and start again.

Problems like the microphone not being found or the live transcript not connecting can happen on the web too. See [Troubleshooting](help:troubleshooting).

## Frequently asked questions {#faq}

### Does recording stop when I close the window?
No. Closing the window doesn't quit the app, and recording continues. To open it again, click the HeyMoa icon in the menu bar or the notification area of the taskbar.

### Does the app update automatically?
No. There are no automatic updates. When a new version comes out, install it yourself.

### Can I use it on an Intel Mac?
No. On Mac, only Apple Silicon is supported. You can use the web service in your browser instead. Only your microphone is recorded there.

## Related pages {#related}

- [I want to record video calls too](help:record-call-audio) — From installing to recording
- [Recording doesn't work in the desktop app](help:desktop-no-audio) — Permission and sound problems
- [Recording and your microphone](help:recording) — How to record on the web
