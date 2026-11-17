import {
  getCurrentUser,
  recordConsents,
} from "@/lib/api/generated/users/users";
import type { CurrentUserResponseData } from "@/lib/api/generated/models";

const KEY = "heymoa:login-consent";
const TTL_MS = 30 * 60 * 1000;

export function rememberLoginConsent(now = Date.now()) {
  try {
    window.sessionStorage.setItem(KEY, String(now));
  } catch {}
}

function hasLoginConsent(now = Date.now()) {
  try {
    const at = Number(window.sessionStorage.getItem(KEY));
    return at > 0 && now - at < TTL_MS;
  } catch {
    return false;
  }
}

function forgetLoginConsent() {
  try {
    window.sessionStorage.removeItem(KEY);
  } catch {}
}

async function loadAccount(): Promise<CurrentUserResponseData> {
  const response = await getCurrentUser();
  if (response.status !== 200 || !response.data.success) {
    throw new Error("CURRENT_USER_FAILED");
  }
  return response.data.data;
}

async function record(account: CurrentUserResponseData) {
  await recordConsents({
    consents: account.consents.map(({ documentType, currentVersion }) => ({
      documentType,
      version: currentVersion,
    })),
  });
  forgetLoginConsent();
}

export async function settleLoginConsent(): Promise<"done" | "ask"> {
  const account = await loadAccount();
  if (!account.consentRequired) {
    forgetLoginConsent();
    return "done";
  }
  if (!hasLoginConsent()) return "ask";
  await record(account);
  return "done";
}

export async function recordConsentNow() {
  const account = await loadAccount();
  if (account.consentRequired) await record(account);
  else forgetLoginConsent();
}
