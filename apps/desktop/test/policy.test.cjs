const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  PRODUCTION_ORIGIN,
  applicationUrl,
  isTrustedUrl,
  externalUrl,
  trustedSender,
  platformSupport,
  recordingSummary,
  emptyRequest,
} = require("../dist/policy.js");

test("production ignores URL overrides and development only accepts loopback", () => {
  assert.equal(applicationUrl(true, "https://evil.test"), PRODUCTION_ORIGIN);
  assert.equal(applicationUrl(false), PRODUCTION_ORIGIN);
  for (const url of [
    "http://localhost:3000/w",
    "http://127.0.0.1:3000",
    "http://[::1]:3000",
  ])
    assert.doesNotThrow(() => applicationUrl(false, url));
  for (const url of [
    "https://evil.test",
    "http://localhost.evil.test",
    "file:///tmp/test",
    "http://user:pass@localhost",
    "bad-url",
  ])
    assert.throws(() => applicationUrl(false, url));
});
test("origin policy rejects lookalikes, credentials, dangerous schemes and ports", () => {
  assert.equal(
    isTrustedUrl("https://heymoa.app/w/test", PRODUCTION_ORIGIN),
    true
  );
  for (const url of [
    "https://heymoa.app.evil.test",
    "https://evil.test/heymoa.app",
    "http://heymoa.app",
    "https://heymoa.app:8443",
    "https://u:p@heymoa.app",
    "javascript:alert(1)",
    "file:///tmp/test",
  ])
    assert.equal(isTrustedUrl(url, PRODUCTION_ORIGIN), false);
  assert.equal(
    externalUrl("https://example.com/path", PRODUCTION_ORIGIN),
    "https://example.com/path"
  );
  for (const url of [
    "https://heymoa.app/w",
    "javascript:alert(1)",
    "file:///tmp/test",
    "https://u:p@example.com",
  ])
    assert.equal(externalUrl(url, PRODUCTION_ORIGIN), null);
});
test("IPC authorization requires the exact webContents, current mainFrame and origin", () => {
  const contents = {},
    frame = {},
    other = {};
  assert.equal(
    trustedSender(
      contents,
      contents,
      frame,
      frame,
      "https://heymoa.app/w",
      PRODUCTION_ORIGIN
    ),
    true
  );
  for (const args of [
    [other, contents, frame, frame],
    [contents, contents, other, frame],
    [contents, contents, null, null],
    [contents, contents, undefined, undefined],
  ])
    assert.equal(
      trustedSender(...args, PRODUCTION_ORIGIN, PRODUCTION_ORIGIN),
      false
    );
  assert.equal(
    trustedSender(
      contents,
      contents,
      frame,
      frame,
      "https://evil.test",
      PRODUCTION_ORIGIN
    ),
    false
  );
});
test("supported OS matrix uses real Windows kernel build and macOS versions", () => {
  for (const [platform, arch, version] of [
    ["darwin", "arm64", "14.2"],
    ["darwin", "x64", "14.2.0"],
    ["darwin", "arm64", "26.0.1"],
    ["win32", "x64", "10.0.22000"],
    ["win32", "x64", "10.0.26100"],
  ])
    assert.equal(platformSupport(platform, arch, version).supported, true);
  for (const [platform, arch, version] of [
    ["darwin", "arm64", "14.1.9"],
    ["darwin", "x64", "13.6"],
    ["darwin", "ia32", "14.2"],
    ["win32", "x64", "10.0.19045"],
    ["win32", "arm64", "10.0.26100"],
    ["linux", "x64", "6.10.0"],
    ["darwin", "arm64", "14.2wrong"],
  ])
    assert.equal(platformSupport(platform, arch, version).supported, false);
});
test("summary schema preserves pending audio after stop/failure and rejects unsafe values", () => {
  const good = {
    phase: "failed",
    startedAt: 0,
    pendingMs: 300000,
    microphone: "ended",
    systemAudio: "live",
  };
  assert.deepEqual(recordingSummary(good), good);
  for (const value of [
    null,
    [],
    {},
    { ...good, token: "secret" },
    { ...good, pendingMs: -1 },
    { ...good, pendingMs: 300001 },
    { ...good, pendingMs: NaN },
    { ...good, pendingMs: Infinity },
    { ...good, startedAt: 0.5 },
    { ...good, phase: "unknown" },
    { ...good, systemAudio: "unknown" },
  ])
    assert.throws(() => recordingSummary(value));
  assert.equal(emptyRequest(undefined), true);
  for (const value of [null, {}, [], "bad"])
    assert.equal(emptyRequest(value), false);
});
