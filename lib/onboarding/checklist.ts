import type { AnalyticsEvent } from "@/lib/analytics/track";
import type { NoteListResponseData } from "@/lib/api/generated/models";

/**
 * 「시작하기」 체크리스트 (APP-1023).
 *
 * **완료 여부는 되도록 서버 데이터로 본다** — 프로젝트가 있는가, 기록을 시작한 회의가 있는가.
 * 브라우저와 데스크톱 앱은 localStorage를 나눠 쓰지 않아서(`persist:heymoa` 파티션) 기기에만
 * 적어 두면 한쪽에서 한 일이 다른 쪽에서 안 한 것으로 보인다. 서버로 알 수 없는 둘(요약 검토,
 * 초대)만 「이 기기에서 해 봤다」로 적는다.
 *
 * 기기에 두는 것은 그것과 「닫았다」뿐이다. 그래서 브라우저에서 닫아도 앱에서 한 번 더 보일 수
 * 있다 — 기기를 넘어 맞추려면 서버에 사용자 설정이 있어야 해서 지금은 받아들인다.
 */
export const CHECKLIST_STEPS = [
  { id: "project", label: "프로젝트 만들기", optional: false },
  { id: "record", label: "첫 회의 기록하기", optional: false },
  { id: "confirm", label: "요약 검토 완료하기", optional: false },
  // 혼자 쓰는 사람도 끝까지 갈 수 있게 초대는 선택이다 — 필수 셋을 마치면 닫힌다
  { id: "invite", label: "팀원 초대하기", optional: true },
] as const;

const REQUIRED_STEPS = CHECKLIST_STEPS.filter((step) => !step.optional);

/** 필수 단계를 몇 개 마쳤나. 선택 단계(초대)는 세지 않는다. */
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

/** 이 이벤트가 나면 그 단계를 이 기기에서 해 본 것으로 적는다. */
export const STEP_OF_EVENT: Partial<Record<AnalyticsEvent, ChecklistStepId>> = {
  recording_started: "record",
  summary_confirmed: "confirm",
  invite_sent: "invite",
};

export type ChecklistFacts = {
  hasProject: boolean;
  hasRecording: boolean;
};

/**
 * 기록을 시작한 회의가 있는가. 목록은 첫 쪽(30개)만 읽는다 — 뒤에 더 있는 워크스페이스는 새 워크스페이스가
 * 아니라서, 첫 쪽에 기록이 안 보여도 있는 것으로 본다. 아니면 기존 사용자에게 체크리스트가 열린다(codex 리뷰).
 */
export function hasRecordedMeeting(page: Pick<NoteListResponseData, "notes" | "hasMore">) {
  return page.hasMore || page.notes.some((note) => note.meetingStartedAt !== null);
}

/**
 * 체크리스트를 그릴지. 열려 있으면 그린다. **처음 판단하기 전에 목록을 못 읽었을 때도** 실패와 다시 시도를
 * 보이려고 그린다 — 안 그리면 판단이 영영 안 나서 새 사용자에게 시작 안내가 조용히 사라진다(codex 리뷰).
 */
export function isChecklistVisible(state: ChecklistState | null, failed: boolean) {
  return state?.status === "open" || (state === null && failed);
}

export function completedSteps(
  state: ChecklistState | null,
  facts: ChecklistFacts
) {
  const done = new Set<ChecklistStepId>(state?.done ?? []);
  if (facts.hasProject) done.add("project");
  if (facts.hasRecording) done.add("record");
  return done;
}

/**
 * 처음 보는 사람의 체크리스트를 열지 닫아 둘지. **기록한 회의가 이미 있는 워크스페이스면 닫아 둔다** —
 * 이 기능이 나오기 전부터 쓰던 사람과, 이미 굴러가는 워크스페이스에 초대된 사람에게 「시작하기
 * 1/5」를 들이밀지 않는다. 그들도 계정 메뉴의 「시작 안내 다시 보기」로 열 수 있다.
 * 정한 값은 적어 두고 다시 정하지 않는다 — 닫힌 사람에게는 목록도 다시 읽지 않는다.
 */
export function firstChecklistStatus(facts: Pick<ChecklistFacts, "hasRecording">) {
  return facts.hasRecording ? ("dismissed" as const) : ("open" as const);
}

const keyOf = (userId: string) => `heymoa:onboarding:${userId}`;
const CHANGE_EVENT = "heymoa:onboarding-change";

/**
 * 저장하지 못한 값(저장소가 막혔거나 꽉 찼다). 있으면 저장소보다 먼저 본다 — 쓰기만 실패하면 저장소에는 옛 값이
 * 남아 닫기·다시 보기·단계 완료가 화면에 안 먹었다(codex 리뷰). 이번 문서 동안만 지켜지고 다음 방문에는 다시 보인다.
 */
const unsaved = new Map<string, string>();

/** `useSyncExternalStore`의 스냅숏이라 문자열 그대로 돌려준다 — 파싱한 객체는 매번 달라진다. */
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

/** 지금 값을 읽어 바꾼다. `null`을 돌려주면 쓰지 않는다. */
export function updateChecklist(
  userId: string,
  change: (state: ChecklistState | null) => ChecklistState | null
) {
  const next = change(parseChecklist(readChecklistRaw(userId)));
  if (next) writeChecklist(userId, next);
}

/** 이 기기에서 그 단계를 해 봤다. 체크리스트를 연 적 없는 사람에게는 적지 않는다. */
export function markStepDone(userId: string, step: ChecklistStepId) {
  updateChecklist(userId, (state) =>
    state && !state.done.includes(step)
      ? { ...state, done: [...state.done, step] }
      : null
  );
}

export function subscribeChecklist(onChange: () => void) {
  // `storage`는 다른 탭에서 바꾼 것을, 우리 이벤트는 같은 탭에서 바꾼 것을 알린다.
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}
