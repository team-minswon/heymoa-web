export { createHelpDemoState } from "@/lib/mocks/help-demo/build";
export { helpDemoPack } from "@/lib/mocks/help-demo/pack";
export { HD_NOTE_IDS as HELP_DEMO_NOTE_IDS } from "@/lib/mocks/help-demo/notes";
export { HD_WORKSPACE_ID as HELP_DEMO_WORKSPACE_ID } from "@/lib/mocks/help-demo/people";
export type { HelpDemoReviewSet } from "@/lib/mocks/help-demo/reviews";
export type { TaskSeedRow } from "@/lib/mocks/help-demo/tasks";

export const HELP_DEMO_STORAGE_KEY = "heymoa:helpDemo";

export function isHelpDemoEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (new URLSearchParams(window.location.search).get("helpDemo") === "1") {
      try {
        window.localStorage.setItem(HELP_DEMO_STORAGE_KEY, "1");
      } catch {
      }
      return true;
    }
    return window.localStorage.getItem(HELP_DEMO_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}
