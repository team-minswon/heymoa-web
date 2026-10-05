import { contextBridge, ipcRenderer } from "electron";
import type { OnboardingAction, OnboardingView } from "./onboarding";

if (process.isMainFrame)
  contextBridge.exposeInMainWorld(
    "heymoaOnboarding",
    Object.freeze({
      action: (action: OnboardingAction): Promise<OnboardingView> =>
        ipcRenderer.invoke("heymoa:onboarding", action),
    })
  );
