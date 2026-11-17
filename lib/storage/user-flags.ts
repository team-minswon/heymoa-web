import { clearChecklist } from "@/lib/onboarding/checklist";
import { deleteAudioStore } from "@/lib/transcription/audio-store";

const PREFIX = "heymoa:u:";

const USER_FLAGS = {
  agentIntroDismissed: "agent-intro-dismissed",
  endNudgeOff: "end-nudge-off",
  endFeedbackOff: "end-feedback-off",
  endFeedbackNextAt: "end-feedback-next-at",
} as const;

type UserFlag = keyof typeof USER_FLAGS;

const LEGACY_KEYS = [
  "heymoa:agent-intro-dismissed",
  "heymoa:end-nudge-off",
  "heymoa:feedback-seen",
  "heymoa:desktop-promo-dismissed",
];

const LEGACY_USER_FLAGS = ["feedback-seen"];

let purged = false;

function purgeLegacyOnce() {
  if (purged) return;
  purged = true;
  try {
    const storage = window.localStorage;
    for (const key of LEGACY_KEYS) storage.removeItem(key);
    for (let index = storage.length - 1; index >= 0; index -= 1) {
      const key = storage.key(index);
      if (
        key?.startsWith(PREFIX) &&
        LEGACY_USER_FLAGS.some((flag) => key.endsWith(`:${flag}`))
      )
        storage.removeItem(key);
    }
  } catch {}
}

const keyOf = (userId: string, flag: UserFlag) =>
  `${PREFIX}${userId}:${USER_FLAGS[flag]}`;

export function readUserFlag(
  userId: string,
  flag: UserFlag
): string | null | undefined {
  purgeLegacyOnce();
  try {
    return window.localStorage.getItem(keyOf(userId, flag));
  } catch {
    return undefined;
  }
}

export function writeUserFlag(
  userId: string,
  flag: UserFlag,
  value: string
): boolean {
  try {
    window.localStorage.setItem(keyOf(userId, flag), value);
    return true;
  } catch {
    return false;
  }
}

export function clearUserFlags() {
  try {
    const storage = window.localStorage;
    for (let index = storage.length - 1; index >= 0; index -= 1) {
      const key = storage.key(index);
      if (key?.startsWith(PREFIX)) storage.removeItem(key);
    }
  } catch {}
}

export async function forgetDeletedAccount(userId: string) {
  clearUserFlags();
  clearChecklist(userId);
  await deleteAudioStore().catch(() => undefined);
}
