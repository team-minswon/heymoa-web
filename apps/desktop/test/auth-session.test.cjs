const { test } = require("node:test");
const assert = require("node:assert/strict");
const { authPost } = require("../dist/auth-session");
const signal = () => new AbortController().signal;
const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status });
const ticket =
  "/v1/workspaces/0A1B2C3D4E5F6/integrations/LINEAR/desktop-ticket";

test("exchange includes session cookies, blocks redirects, and returns data only", async () => {
  const abort = signal();
  const post = authPost(async (url, options) => {
    assert.equal(url, "https://api.heymoa.app/v1/auth/desktop/exchange");
    assert.equal(options.credentials, "include");
    assert.equal(options.redirect, "error");
    assert.equal(options.headers.Origin, "https://heymoa.app");
    assert.equal(options.signal, abort);
    return json({ success: true, data: { message: "ok" } });
  }, "https://heymoa.app");
  assert.deepEqual(
    await post("/v1/auth/desktop/exchange", { code: "test" }, abort),
    { message: "ok" }
  );
});
test("expired connection access cookie refreshes once then retries original ticket", async () => {
  const routes = [];
  const post = authPost(async (url) => {
    routes.push(new URL(url).pathname);
    return routes.length === 1
      ? json({ success: false }, 401)
      : json({ success: true, data: {} });
  }, "https://heymoa.app");
  await post(ticket, { state: "test" }, signal());
  assert.deepEqual(routes, [ticket, "/v1/auth/refresh", ticket]);
});
test("failed refresh does not retry or falsely finish a connection", async () => {
  let calls = 0;
  const post = authPost(async () => {
    calls++;
    return json({ success: false }, calls === 1 ? 401 : 200);
  }, "https://heymoa.app");
  await assert.rejects(
    post(ticket, {}, signal()),
    /DESKTOP_AUTH_REQUEST_FAILED/
  );
  assert.equal(calls, 2);
});
test("login failures never refresh another session and success=false is rejected", async () => {
  for (const status of [401, 200]) {
    let calls = 0;
    const post = authPost(async () => {
      calls++;
      return json({ success: false }, status);
    }, "https://heymoa.app");
    await assert.rejects(post("/v1/auth/desktop/start", {}, signal()));
    assert.equal(calls, 1);
  }
});
test("adapter rejects arbitrary URLs and traversal before sending cookies", async () => {
  const post = authPost(async () => {
    assert.fail("unexpected network request");
  }, "https://heymoa.app");
  for (const route of [
    "https://evil.invalid",
    "/v1/auth/logout",
    "/v1/workspaces/../integrations/LINEAR/desktop-ticket",
  ])
    await assert.rejects(
      post(route, {}, signal()),
      /INVALID_DESKTOP_AUTH_ROUTE/
    );
});
