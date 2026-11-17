import { test } from "@playwright/test";

import {
  dialogStabilityTests,
  notificationScrollbarTests,
} from "./helpers-dialog-stability";

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
notificationScrollbarTests(true);
