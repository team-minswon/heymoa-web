import { test } from "@playwright/test";

import { dialogStabilityTests } from "./helpers-dialog-stability";

// 클래식 스크롤바(폭 15px)가 있는 실제 데스크톱 조건. 헤드리스는 기본으로 스크롤바를 숨긴다(--hide-scrollbars) — 그 인자를 뺀다.
// (`launchOptions` 는 파일 맨 위에서만 쓸 수 있어 별도 파일이다.)
test.use({
  launchOptions: {
    ignoreDefaultArgs: ["--hide-scrollbars"],
    args: [
      "--use-fake-device-for-media-stream",
      "--use-fake-ui-for-media-stream",
    ],
  },
});

dialogStabilityTests(true);
