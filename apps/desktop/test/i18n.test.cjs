const { test } = require("node:test");
const assert = require("node:assert/strict");
const { formatElapsed } = require("../dist/i18n");

test("elapsed clocks preserve minutes below an hour and use hours above it", () => {
  for (const [seconds, expected] of [[0, "0:00"], [59, "0:59"], [60, "1:00"], [3599, "59:59"], [3600, "1:00:00"], [4680, "1:18:00"], [90000, "25:00:00"]]) {
    assert.equal(formatElapsed(seconds), expected);
  }
});
