"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { AnimatePresence, motion, useIsPresent } from "motion/react";
import { X } from "lucide-react";

import { CountdownBar, useNudgeMotion } from "@/components/notes/nudge-bubble";
import { track } from "@/lib/analytics/track";
import type { MeetingPhase } from "@/lib/notes/meeting-state";

/**
 * 타임라인 첫 항목 안내(APP-1333). 스크립트만 보는 첫 사용자가 타임라인 탭을 발견하게 한 줄을 띄운다.
 *
 * 졸업 기록은 **브라우저별** 한 키다(spec 미작성 — PRD 열린 결정을 이 이슈에서 정했다).
 * - `done`: 탭을 직접 열었거나 말풍선을 눌렀거나 ×로 닫았다. 다시 안 띄운다
 * - `auto:<noteId>`: 그 회의에서 저절로 사라졌다. 그 회의에서는 안 띄우고 다음 회의에 한 번 더 띄운다.
 *   다음 회의에서도 저절로 사라지면 `done` — 「한 번 더」다
 */
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

/**
 * 띄울 자리인가. 항목이 「있다」로 판정한다 — 늦게 들어온 관전자는 새 항목 이벤트를 못 받는다.
 * 녹음하는 사람과 보기만 하는 사람에게 같은 규칙이고, 끝난 회의에서는 안 띄운다.
 */
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

/** 다른 탭에서 졸업해도 따라간다. 이 탭의 쓰기는 `closedFor` 가 바로 반영한다. */
function subscribe(notify: () => void) {
  window.addEventListener("storage", notify);
  return () => window.removeEventListener("storage", notify);
}

/** 타임라인 탭을 직접 열었다. 말풍선이 떠 있지 않아도 탭을 찾았으니 졸업이다. */
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
  /** 진행 중인 회의 · 항목 있음 · 스크립트 탭. 판정은 부모가 한다. */
  eligible: boolean;
  role: "recorder" | "viewer";
  /** 타임라인 탭으로 옮긴다. */
  onOpen: () => void;
}) {
  // 이 화면에서 닫았거나 사라진 노트. 저장소가 막혀도 같은 회의에서 다시 뜨지 않게 한다.
  const [closedFor, setClosedFor] = useState<string | null>(null);
  // 서버 렌더에서는 안 띄운다 — 저장소를 모르는 채 그렸다가 하이드레이션에서 어긋난다.
  const stored = useSyncExternalStore(subscribe, read, () => "done");
  // 한 노트에서 한 번만 「띄웠다」고 센다. 다른 탭에 갔다 오면 말풍선은 다시 서지만 같은 띄움이다.
  const announced = useRef<string | null>(null);
  const visible =
    eligible &&
    closedFor !== noteId &&
    stored !== "done" &&
    stored !== `auto:${noteId}`;
  // 닫히거나 자격을 잃어도 퇴장이 끝난 뒤에 빠진다. 퇴장 중 다시 자격이 생기면 같은 말풍선이 되돌아온다.
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
  const hovered = useRef(false);
  const focused = useRef(false);
  // 퇴장 중에는 세지 않는다 — 자격을 잃어 접히는 사이에 시간이 다 되면 「저절로 사라짐」으로 잘못 기록된다.
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
    // 창이 보이고 포커스가 있고 마우스·키보드 포커스가 말풍선에 없을 때만 센다 — 딴 창을 보던 사이에
    // 사라지면 못 본 것이고, 읽거나 누르려는 사이에 사라지면 안 된다(WCAG 2.2.1). 막대도 같이 선다.
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
    // 마운트 한 번이 한 번 띄움이다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <motion.div
      role="status"
      {...motionProps}
      // 접히는 동안은 누를 수 없다.
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
      // 탭 아래 가운데. 위 화살표가 탭을 가리킨다. 오래 남지 않으니 아래 「복사」를 잠깐 덮어도 된다.
      // 가운데 맞춤은 `translate` 속성(-translate-x-1/2)이라 motion 의 `transform` 과 겹치지 않는다.
      className="absolute left-1/2 top-full z-30 mt-1 flex -translate-x-1/2 items-center gap-1 rounded-control bg-foreground py-1 pl-3 pr-1 text-xs text-background shadow-e2 before:absolute before:-top-1 before:left-1/2 before:size-2.5 before:-translate-x-1/2 before:rotate-45 before:rounded-[2px] before:bg-foreground"
    >
      <button
        type="button"
        onClick={onOpen}
        className="relative whitespace-nowrap py-1 font-medium max-sm:w-40 max-sm:whitespace-normal"
      >
        타임라인에 정리된 항목이 생겼어요
      </button>
      <button
        type="button"
        aria-label="안내 닫기"
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
