import type { CSSProperties } from "react";

import { TV_VARS } from "@/components/heymoa/landing/tokens";

/**
 * 사용 가이드의 색. 가이드 컴포넌트는 `--tv-*` 로 칠하는데, 그 중 보라 틴트(`ink`·`body`·`muted`·`rule`·`lav`)를 제품 화면과
 * 같은 중립 회색(`--el-*`)으로 **여기서 한 번만** 갈아 끼운다. 강조색(`--tv-brand`·`--tv-pop` 등)은 그대로라 링크·활성 항목·
 * 단계 번호·버튼의 위계는 유지된다. 가이드의 루트와 포털(대화상자)이 이 값을 `style` 로 건다 — 새 색을 만들지 않는다.
 *
 * - `lav`(머리말 판·칩) = `surface-strong`, `lav-soft`(사이드바·목차·콜아웃 판) = `canvas` — 한 단계씩 벌려 패널 위 흰 hover 가 보인다.
 * - `muted` 는 회색 판 위에서 4.5:1 을 넘기도록 `--el-muted` 를 `--el-body` 쪽으로 30% 당긴 값이다(`--el-muted` 단독은 회색 판 위에서 4.2~4.4:1).
 */
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
