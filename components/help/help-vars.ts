import type { CSSProperties } from "react";

import { TV_VARS } from "@/components/heymoa/landing/tokens";

export const HELP_VARS = {
  ...TV_VARS,
  "--tv-ink": "var(--el-ink)",
  "--tv-body": "var(--el-body)",
  "--tv-muted": "color-mix(in srgb, var(--el-muted) 70%, var(--el-body))",
  "--tv-rule": "var(--el-hairline)",
  "--tv-rule-strong": "var(--el-hairline-strong)",
  "--tv-lav": "var(--el-surface-strong)",
  "--tv-lav-soft": "var(--el-canvas)",
} as CSSProperties;

export const HELP_OVERLAY =
  "bg-black/15 duration-(--help-base) supports-backdrop-filter:backdrop-blur-none motion-reduce:duration-0";
