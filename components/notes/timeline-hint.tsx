"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { AnimatePresence, motion, useIsPresent } from "motion/react";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";

import { CountdownBar, useNudgeMotion } from "@/components/notes/nudge-bubble";
import { track } from "@/lib/analytics/track";
import type { MeetingPhase } from "@/lib/notes/meeting-state";

const STORAGE_KEY = "heymoa:timeline-hint";
export const TIMELINE_HINT_MS = 60_000;
const TICK_MS = 250;

function read() {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function write(value: string) {
  try {
    localStorage.setItem(STORAGE_KEY, value);
  } catch {
    // 저장소가 막힌 브라우저 — 이번 화면에서는 컴포넌트 상태가 지킨다.
  }
}

export function timelineHintEligible({
  phase,
  tab,
  itemCount,
}: {
  phase: MeetingPhase;
  tab: string;
  itemCount: number;
}) {
  return (
    (phase === "active" || phase === "paused") &&
    tab === "transcript" &&
    itemCount > 0
  );
}

function subscribe(notify: () => void) {
  window.addEventListener("storage", notify);
  return () => window.removeEventListener("storage", notify);
}

export function graduateTimelineHint() {
  write("done");
}

export function TimelineHint({
  noteId,
  workspaceId,
  eligible,
  role,
  onOpen,
}: {
  noteId: string;
  workspaceId: string;
  eligible: boolean;
  role: "recorder" | "viewer";
  onOpen: () => void;
}) {
  const [closedFor, setClosedFor] = useState<string | null>(null);
  // 서버 렌더에서는 안 띄운다 — 저장소를 모르는 채 그렸다가 하이드레이션에서 어긋난다.
  const stored = useSyncExternalStore(subscribe, read, () => "done");
  const announced = useRef<string | null>(null);
  const visible =
    eligible &&
    closedFor !== noteId &&
    stored !== "done" &&
    stored !== `auto:${noteId}`;
  return (
    <AnimatePresence>
      {visible ? (
        <HintBubble
          key={noteId}
          onShown={() => {
            if (announced.current === noteId) return;
            announced.current = noteId;
            track("timeline_hint_shown", { workspace_id: workspaceId, role });
          }}
          onOpen={() => {
            graduateTimelineHint();
            setClosedFor(noteId);
            track("timeline_hint_clicked", { workspace_id: workspaceId, role });
            onOpen();
          }}
          onDismiss={(reason) => {
            if (reason === "close") write("done");
            else {
              const prev = read();
              write(
                prev?.startsWith("auto:") && prev !== `auto:${noteId}`
                  ? "done"
                  : `auto:${noteId}`
              );
            }
            setClosedFor(noteId);
            track("timeline_hint_dismissed", {
              workspace_id: workspaceId,
              reason,
            });
          }}
        />
      ) : null}
    </AnimatePresence>
  );
}

function HintBubble({
  onShown,
  onOpen,
  onDismiss,
}: {
  onShown: () => void;
  onOpen: () => void;
  onDismiss: (reason: "auto" | "close") => void;
}) {
  const t = useTranslations("notes.timeline.hint");
  const hovered = useRef(false);
  const focused = useRef(false);
  const present = useIsPresent();
  const presentRef = useRef(present);
  const [paused, setPaused] = useState(false);
  const dismiss = useRef(onDismiss);
  useEffect(() => {
    dismiss.current = onDismiss;
    presentRef.current = present;
  });
  const motionProps = useNudgeMotion("top center");

  useEffect(() => {
    onShown();
    let elapsed = 0;
    const timer = window.setInterval(() => {
      const hold =
        document.hidden ||
        !document.hasFocus() ||
        hovered.current ||
        focused.current ||
        !presentRef.current;
      setPaused(hold);
      if (hold) return;
      elapsed += TICK_MS;
      if (elapsed >= TIMELINE_HINT_MS) {
        window.clearInterval(timer);
        dismiss.current("auto");
      }
    }, TICK_MS);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <motion.div
      role="status"
      {...motionProps}
      inert={!present}
      onMouseEnter={() => {
        hovered.current = true;
        setPaused(true);
      }}
      onMouseLeave={() => (hovered.current = false)}
      onFocus={() => {
        focused.current = true;
        setPaused(true);
      }}
      onBlur={(e) => {
        focused.current = e.currentTarget.contains(e.relatedTarget);
      }}
      // 가운데 맞춤은 `translate` 속성(-translate-x-1/2)이라 motion 의 `transform` 과 겹치지 않는다.
      className="absolute left-1/2 top-full z-30 mt-1 flex -translate-x-1/2 items-center gap-1 rounded-control bg-foreground py-1 pl-3 pr-1 text-xs text-background shadow-e2 before:absolute before:-top-1 before:left-1/2 before:size-2.5 before:-translate-x-1/2 before:rotate-45 before:rounded-[2px] before:bg-foreground"
    >
      <button
        type="button"
        onClick={onOpen}
        className="relative whitespace-nowrap py-1 font-medium max-sm:w-40 max-sm:whitespace-normal"
      >
        {t("message")}
      </button>
      <button
        type="button"
        aria-label={t("dismiss")}
        onClick={() => onDismiss("close")}
        className="relative flex size-6 shrink-0 items-center justify-center rounded-full opacity-70 hover:opacity-100"
      >
        <X className="size-3.5" aria-hidden />
      </button>
      <CountdownBar
        ms={TIMELINE_HINT_MS}
        paused={paused}
        className="rounded-b-control"
        barClassName="bg-background/50"
      />
    </motion.div>
  );
}
