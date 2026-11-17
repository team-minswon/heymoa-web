import type { AnalysisResultResponseDataSectionsItemKind } from "@/lib/api/generated/models";

export const SECTION_ORDER = [
  "OVERVIEW",
  "ACTION_ITEM",
  "DECISION",
] as const satisfies readonly AnalysisResultResponseDataSectionsItemKind[];
