import { setupWorker } from "msw/browser";

import { mockDb } from "@/lib/mocks/db";
import { handlers } from "@/lib/mocks/handlers";
import { mockNotificationArrives } from "@/lib/mocks/user-events";

export const worker = setupWorker(...handlers);

declare global {
  interface Window {
    heymoaMock?: { notify: typeof mockNotificationArrives };
  }
}
window.heymoaMock = { notify: mockNotificationArrives };

try {
  if (window.localStorage.getItem("mockConsent") === "required") {
    mockDb.requireConsent();
  }
  const failures = Number(window.localStorage.getItem("mockConsentFail"));
  if (failures > 0) mockDb.failNextConsents(failures);
} catch {}
