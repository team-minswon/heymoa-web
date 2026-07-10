export const AUTH_STATE_CHANGED_EVENT = "heymoa:auth-state-changed";

export type AuthStateChangedDetail = {
  reason: "logout" | "unauthenticated";
};

export function notifyAuthStateChanged(detail: AuthStateChangedDetail) {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(
    new CustomEvent<AuthStateChangedDetail>(AUTH_STATE_CHANGED_EVENT, {
      detail,
    })
  );
}
