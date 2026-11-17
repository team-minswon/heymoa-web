import type { AnalyticsEvent } from "@/lib/analytics/track";
import type { NoteListResponseData } from "@/lib/api/generated/models";

export const CHECKLIST_STEPS = [
  { id: "record", optional: false },
  { id: "confirm", optional: false },
  { id: "invite", optional: true },
] as const;

const REQUIRED_STEPS = CHECKLIST_STEPS.filter((step) => !step.optional);

export function requiredProgress(done: ReadonlySet<ChecklistStepId>) {
  return {
    done: REQUIRED_STEPS.filter((step) => done.has(step.id)).length,
    total: REQUIRED_STEPS.length,
  };
}

export type ChecklistStepId = (typeof CHECKLIST_STEPS)[number]["id"];

export type ChecklistState = {
  status: "open" | "dismissed";
  done: ChecklistStepId[];
};

export const STEP_OF_EVENT: Partial<Record<AnalyticsEvent, ChecklistStepId>> = {
  recording_started: "record",
  summary_confirmed: "confirm",
  invite_sent: "invite",
};

export type ChecklistFacts = {
  hasRecording: boolean;
};

export function hasRecordedMeeting(
  page: Pick<NoteListResponseData, "notes" | "hasMore">
) {
  return (
    page.hasMore || page.notes.some((note) => note.meetingStartedAt !== null)
  );
}

export function isChecklistVisible(
  state: ChecklistState | null,
  failed: boolean
) {
  return state?.status === "open" || (state === null && failed);
}

export function completedSteps(
  state: ChecklistState | null,
  facts: ChecklistFacts
) {
  const done = new Set<ChecklistStepId>(state?.done ?? []);
  if (facts.hasRecording) done.add("record");
  return done;
}

export function firstChecklistStatus(
  facts: Pick<ChecklistFacts, "hasRecording">
) {
  return facts.hasRecording ? ("dismissed" as const) : ("open" as const);
}

const keyOf = (userId: string) => `heymoa:onboarding:${userId}`;
const CHANGE_EVENT = "heymoa:onboarding-change";

const unsaved = new Map<string, string>();

/** `useSyncExternalStore` 의 스냅숏이라 문자열 그대로 돌려줍니다. 파싱한 객체는 매번 달라집니다. */
export function readChecklistRaw(userId: string) {
  const pending = unsaved.get(userId);
  if (pending !== undefined) return pending;
  try {
    return localStorage.getItem(keyOf(userId));
  } catch {
    return null;
  }
}

export function parseChecklist(raw: string | null): ChecklistState | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<ChecklistState>;
    if (value.status !== "open" && value.status !== "dismissed") return null;
    const known = new Set<string>(CHECKLIST_STEPS.map((step) => step.id));
    return {
      status: value.status,
      done: (Array.isArray(value.done) ? value.done : []).filter(
        (id): id is ChecklistStepId => known.has(id)
      ),
    };
  } catch {
    return null;
  }
}

export function writeChecklist(userId: string, state: ChecklistState) {
  const raw = JSON.stringify(state);
  try {
    localStorage.setItem(keyOf(userId), raw);
    unsaved.delete(userId);
  } catch {
    unsaved.set(userId, raw);
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function updateChecklist(
  userId: string,
  change: (state: ChecklistState | null) => ChecklistState | null
) {
  const next = change(parseChecklist(readChecklistRaw(userId)));
  if (next) writeChecklist(userId, next);
}

export function markStepDone(userId: string, step: ChecklistStepId) {
  updateChecklist(userId, (state) =>
    state && !state.done.includes(step)
      ? { ...state, done: [...state.done, step] }
      : null
  );
}

export function clearChecklist(userId: string) {
  unsaved.delete(userId);
  try {
    localStorage.removeItem(keyOf(userId));
  } catch {}
}

export function subscribeChecklist(onChange: () => void) {
  // `storage` 는 다른 탭의 변경만 알리므로 같은 탭은 우리 이벤트로 받습니다.
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}
