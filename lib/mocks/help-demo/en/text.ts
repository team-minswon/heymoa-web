import type { ParsedScript } from "@/lib/mocks/help-demo/script";

/** English counterpart of `../text.ts`. */
export const HD_TEXT = {
  workspaceName: "Brightside Studio",
  workspaceDescription: "Where our marketing team keeps campaigns, the new product launch, and customer interviews in one place.",
  practiceWorkspaceName: "Practice space",
  invitingWorkspaceName: "Design Team",
};

export const PAUSED_SCRIPT: ParsedScript = {
  lines: [
    { label: "A", text: "Let's go through twelve of the twenty FAQ drafts together first." },
    { label: "B", text: "Sure. I left the launch date and pricing questions blank since those aren't final yet." },
    { label: "A", text: "Let's skip those two and tighten up the wording on the rest." },
  ],
  anchors: {},
};
