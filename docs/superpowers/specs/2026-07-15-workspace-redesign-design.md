# Design Spec: Workspace 3-Column Redesign & Visual Polish

This specification outlines the UI/UX overhaul of the HeyMoa workspace, user profile, projects, note feed, details view, and live transcription slider. It is structured around the ElevenLabs editorial theme guidelines (off-white canvas, serif headers, near-black ink pills, and atmospheric gradient orbs).

---

## 1. Objectives & UI/UX Principles

- **3-Column Layout**: Left Sidebar $\rightarrow$ Center Note Feed $\rightarrow$ Right Note Details & Live Transcription.
- **Editorial Magazine Aesthetic**: EB Garamond display headings at weight 300 with negative letter-spacing, and Inter body text at 400/500 with loose tracking (`+0.16px`).
- **Atmospheric Depth**: Floating card structures (`rounded-2xl border bg-white shadow-[0_4px_16px_rgba(0,0,0,0.04)]`) and soft drifting pastel gradient orbs as background layers.
- **Robust Notifications**: Install and integrate `sonner` for sleek, unified toast error/success feedback.
- **Responsive Collapsing**: Automatically collapse into a single-pane on mobile/tablet view.

---

## 2. Proposed Architectural Changes

### Column 1: Workspace & Profile Sidebar (Left)

- **Visual Refinements**:
  - Change sidebar background to a warm off-white glassmorphic texture (`rgba(250, 250, 250, 0.85)` with `backdrop-blur-md`).
  - Add a subtle horizontal hairline divider between segments.
- **Workspace Selector**:
  - Redesign the dropdown trigger as an elegant, card-like tile with a serif workspace moniker and a clean, small badge.
- **User Profile Card**:
  - Positioned floating at the bottom with a clean circular avatar (`{rounded.full}`), small body-sm typography, and a chevron toggle trigger opening a styled, minimal popover menu.

### Column 2: Note List Feed (Center)

- **Layout**:
  - Occupies the middle pane. Displays a header with Waldenburg/EB Garamond display serif typography, negative tracking, and a badge count of total notes.
  - Note list displays as a vertical feed of individual floating cards.
- **Note Feed Cards**:
  - Each note row is styled as a card using `rounded-2xl border border-[var(--el-hairline)] bg-white p-5 shadow-[0_4px_16px_rgba(0,0,0,0.04)] transition-all hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(0,0,0,0.06)]`.
  - Displays note title in serif, project name as an uppercase badge pill (`rounded-full`), creation date/time, and duration.

### Column 3: Note Panel & Live Transcription (Right)

- **Visual Refinements**:
  - Displays a beautiful placeholder card (with a drifting atmospheric lavender/rose gradient orb in the background and editorial typography) when no note is selected.
  - When selected, renders the note's details, summaries, and transcripts inside a premium floating container.
- **Live Transcription Slide**:
  - When recording is active, shows a glowing red dot animation, a live visual equalizer wave corresponding to microphone amplitude inputs, and real-time spoken text fade-ins (using Framer Motion opacity transitions).

---

## 3. Responsive Layout Strategy

On viewport resize, the application dynamically adjusts columns using Tailwind's layout rules:

- **Desktop (`min-width: 1024px`)**:
  - Column 1 (Sidebar): Floating collapsible sidebar on the left.
  - Column 2 (Note Feed): Takes width `w-[440px]` or `w-2/5`.
  - Column 3 (Details Panel): Takes remaining `flex-1` width.
- **Mobile / Tablet (`width < 1024px`)**:
  - If no note is active: Renders Column 2 (Note Feed) in full width. Column 1 (Sidebar) is accessed via the hamburger toolbar. Column 3 is hidden.
  - If a note is active: Renders Column 3 (Details Panel) in full width. Column 2 (Note Feed) is hidden. Allows back-button navigation to return to the note feed.

---

## 4. Notifications & Toast Integration

- Add `sonner` dependency for modern, un-intrusive notification toasts.
- Add `<Toaster />` globally inside `app/providers.tsx`.
- Trigger toasts for:
  - Workspace defaults updates, edits, and creation.
  - Project additions and deletions.
  - Notes updates or creation errors.
  - Recording starts/stops and WebSocket disconnects.

---

## 5. Clean-Up Review

- No dead pages are present; the dynamic routes `/w/[workspaceId]` and `/w/[workspaceId]/notes/[noteId]` are fully active.
- We will refactor `components/notes/note-route-surface.tsx` to stop displaying floating `Sheet` slide-outs on desktop and embed the panel directly in the 3-column flow.
