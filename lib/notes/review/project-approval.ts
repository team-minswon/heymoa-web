import type { ReviewItem } from "@/lib/notes/review/sections";

export const requiresProjectSelection = (kind: ReviewItem["kind"]) =>
  kind === "DECISION" || kind === "ACTION_ITEM";

export const isProjectIncluded = (
  item: Pick<ReviewItem, "included" | "kind" | "projectSelected">
) =>
  item.included &&
  (!requiresProjectSelection(item.kind) || item.projectSelected);
