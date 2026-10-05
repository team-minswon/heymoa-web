const { afterEach, test } = require("node:test");
const assert = require("node:assert/strict");
const { createHash } = require("node:crypto");
const { DesktopAuthBroker } = require("../dist/auth.js");
const {
  authorizeUrl,
  nativeCallback,
  connectionRequest,
} = require("../dist/auth-policy.js");
const origin = "https://api.heymoa.app";
const ticket = "t".repeat(43);
const code = "c".repeat(43);
const tick = () => new Promise((resolve) => setImmediate(resolve));
const brokers = new Set();
afterEach(() => {
  // Failed assertions must not leave a five-minute timer or pending request alive.
  for (const broker of brokers) broker.cancel();
  brokers.clear();
});
function fixture(options = {}) {
  const requests = [];
  const opened = [];
  const broker = new DesktopAuthBroker({
    apiOrigin: origin,
    post: async (path, body, signal) => {
      requests.push({ path, body: { ...body }, signal });
      if (options.post) return options.post(path, body, signal);
      return path.endsWith("/exchange")
        ? { message: "ok" }
        : {
            authorizeUrl: `${origin}/v1/auth/desktop/authorize?ticket=${ticket}`,
          };
    },
    openBrowser: async (url) => opened.push(url),
    ...options.dependencies,
  });
  brokers.add(broker);
  return { broker, requests, opened };
}
test("only the fixed API authorize path and one ticket reach the OS browser", () => {
  assert.equal(
    authorizeUrl(
      `${origin}/v1/auth/desktop/authorize?ticket=${ticket}`,
      origin
    ),
    `${origin}/v1/auth/desktop/authorize?ticket=${ticket}`
  );
  for (const url of [
    `https://api.heymoa.app.evil.test/v1/auth/desktop/authorize?ticket=${ticket}`,
    `${origin}/v1/auth/desktop/authorize?ticket=${ticket}&ticket=${ticket}`,
    `${origin}/v1/auth/desktop/authorize?ticket=${ticket}&returnTo=https://evil.test`,
    `${origin}/v1/auth/desktop/authorize?ticket=${ticket}#fragment`,
    `${origin}/evil?ticket=${ticket}`,
    `https://user@api.heymoa.app/v1/auth/desktop/authorize?ticket=${ticket}`,
  ])
    assert.throws(() => authorizeUrl(url, origin));
});
test("unsolicited callback schemes, hosts, paths and duplicate params are rejected", () => {
  const state = "s".repeat(43);
  for (const url of [
    `https://auth/callback?state=${state}&code=${code}`,
    `app.heymoa://auth/callback?state=${state}&code=${code}`,
    `app.heymoa:///auth/callback?state=${state}&code=${code}`,
    `app.heymoa:/evil/callback?state=${state}&code=${code}`,
    `app.heymoa:/auth/other?state=${state}&code=${code}`,
    `app.heymoa:/auth/callback?state=${state}&state=${state}&code=${code}`,
    `app.heymoa:/auth/callback?state=${state}&code=${code}&token=secret`,
    `app.heymoa:/auth/callback?state=${state}&code=${code}#fragment`,
  ])
    assert.equal(nativeCallback(url), null);
});
test("login exchange owns verifier and returns only success, then rejects replay", async () => {
  const { broker, requests, opened } = fixture();
  const outcome = broker.begin();
  await tick();
  assert.equal(opened.length, 1);
  const start = requests[0].body;
  assert.equal(start.state.length, 43);
  assert.equal(start.codeChallenge.length, 43);
  assert.equal("codeVerifier" in start, false);
  const url = `app.heymoa:/auth/callback?state=${start.state}&code=${code}`;
  assert.equal(await broker.receive(url), true);
  assert.deepEqual(await outcome, { status: "success" });
  const exchange = requests[1];
  assert.equal(exchange.path, "/v1/auth/desktop/exchange");
  assert.equal(
    createHash("sha256").update(exchange.body.codeVerifier).digest("base64url"),
    start.codeChallenge
  );
  assert.equal(await broker.receive(url), false);
  assert.equal(requests.length, 2);
});
test("wrong state does not consume an authentic pending request", async () => {
  const { broker, requests } = fixture();
  const outcome = broker.begin();
  await tick();
  assert.equal(
    await broker.receive(
      `app.heymoa:/auth/callback?state=${"x".repeat(43)}&code=${code}`
    ),
    false
  );
  assert.equal(requests.length, 1);
  assert.equal(
    await broker.receive(
      `app.heymoa:/auth/callback?state=${requests[0].body.state}&code=${code}`
    ),
    true
  );
  assert.deepEqual(await outcome, { status: "success" });
});
test("cancelled start cannot open a browser when its HTTP response arrives late", async () => {
  let finish;
  const { broker, opened } = fixture({
    post: () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  });
  const outcome = broker.begin();
  broker.cancel();
  assert.deepEqual(await outcome, { status: "cancelled" });
  finish({
    authorizeUrl: `${origin}/v1/auth/desktop/authorize?ticket=${ticket}`,
  });
  await tick();
  assert.deepEqual(opened, []);
});
test("overlapping requests do not replace the current verifier", async () => {
  const { broker, requests } = fixture();
  const first = broker.begin();
  assert.deepEqual(await broker.begin(), { status: "error", reason: "busy" });
  assert.equal(requests.length, 1);
  broker.cancel();
  await first;
});
test("deadline expires before callback even when the event loop timer has not fired", async () => {
  let now = 0;
  const { broker, requests } = fixture({
    dependencies: { now: () => now, timeoutMs: 1000 },
  });
  const outcome = broker.begin();
  await tick();
  now = 1001;
  assert.equal(
    await broker.receive(
      `app.heymoa:/auth/callback?state=${requests[0].body.state}&code=${code}`
    ),
    false
  );
  assert.deepEqual(await outcome, { status: "error", reason: "timeout" });
  assert.equal(requests.length, 1);
});
test("scheduled timeout aborts a hung start and releases the slot without opening its late response", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const responses = [];
  const { broker, requests, opened } = fixture({
    dependencies: { now: () => 0, timeoutMs: 1000 },
    post: () => new Promise((resolve) => responses.push(resolve)),
  });
  t.after(() => broker.cancel());
  const first = broker.begin();
  t.mock.timers.tick(999);
  assert.equal(requests[0].signal.aborted, false);
  t.mock.timers.tick(1);
  assert.deepEqual(await first, { status: "error", reason: "timeout" });
  assert.equal(requests[0].signal.aborted, true);
  const second = broker.begin();
  assert.equal(requests.length, 2);
  responses[0]({
    authorizeUrl: `${origin}/v1/auth/desktop/authorize?ticket=${ticket}`,
  });
  await tick();
  assert.deepEqual(opened, []);
  assert.equal(requests[1].signal.aborted, false);
  broker.cancel();
  assert.deepEqual(await second, { status: "cancelled" });
});
test("a late start response cannot launch OAuth after the deadline before its timer runs", async () => {
  let now = 0,
    respond;
  const { broker, opened } = fixture({
    dependencies: { now: () => now, timeoutMs: 1000 },
    post: () =>
      new Promise((resolve) => {
        respond = resolve;
      }),
  });
  const outcome = broker.begin();
  now = 1000;
  respond({
    authorizeUrl: `${origin}/v1/auth/desktop/authorize?ticket=${ticket}`,
  });
  await tick();
  try {
    assert.deepEqual(opened, []);
  } finally {
    broker.cancel();
  }
  assert.deepEqual(await outcome, { status: "error", reason: "timeout" });
});
test("exchange failure never reports authenticated or returns server details", async () => {
  const { broker, requests } = fixture({
    post: async (path) => {
      if (path.endsWith("exchange"))
        throw new Error("secret provider response");
      return {
        authorizeUrl: `${origin}/v1/auth/desktop/authorize?ticket=${ticket}`,
      };
    },
  });
  const outcome = broker.begin();
  await tick();
  await broker.receive(
    `app.heymoa:/auth/callback?state=${requests[0].body.state}&code=${code}`
  );
  assert.deepEqual(await outcome, { status: "error", reason: "unavailable" });
});
test("late exchange completion reports timeout even when the timer has not run", async () => {
  let now = 0,
    exchange;
  const { broker, requests } = fixture({
    dependencies: { now: () => now, timeoutMs: 1000 },
    post: (path) =>
      path.endsWith("/exchange")
        ? new Promise((resolve) => {
            exchange = resolve;
          })
        : Promise.resolve({
            authorizeUrl: `${origin}/v1/auth/desktop/authorize?ticket=${ticket}`,
          }),
  });
  const outcome = broker.begin();
  await tick();
  const callback = broker.receive(
    `app.heymoa:/auth/callback?state=${requests[0].body.state}&code=${code}`
  );
  now = 1000;
  exchange({ message: "ok" });
  await callback;
  assert.deepEqual(await outcome, { status: "error", reason: "timeout" });
  assert.equal(requests[1].signal.aborted, true);
});
test("provider callback is tied to intended provider, not just state", async () => {
  const { broker, requests } = fixture();
  const outcome = broker.begin({
    workspaceId: "0000000000001",
    provider: "GITHUB",
  });
  await tick();
  const state = requests[0].body.state;
  assert.equal(
    requests[0].path,
    "/v1/workspaces/0000000000001/integrations/GITHUB/desktop-ticket"
  );
  assert.equal(
    await broker.receive(
      `app.heymoa:/integrations/callback?state=${state}&provider=LINEAR&status=success`
    ),
    false
  );
  assert.equal(
    await broker.receive(
      `app.heymoa:/integrations/callback?state=${state}&provider=GITHUB&status=error`
    ),
    true
  );
  assert.deepEqual(await outcome, {
    status: "error",
    reason: "authentication_failed",
  });
});
test("connection payload rejects unexpected keys and path injection", () => {
  assert.deepEqual(
    connectionRequest({ workspaceId: "0000000000001", provider: "LINEAR" }),
    { workspaceId: "0000000000001", provider: "LINEAR" }
  );
  for (const value of [
    { workspaceId: "../admin", provider: "LINEAR" },
    { workspaceId: "0000000000001", provider: "GOOGLE" },
    {
      workspaceId: "0000000000001",
      provider: "LINEAR",
      url: "https://evil.test",
    },
  ])
    assert.throws(() => connectionRequest(value));
});
