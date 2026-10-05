const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  secureContents,
  onDocumentReplacement,
} = require("../dist/security.js");
const { externalUrl, PRODUCTION_ORIGIN } = require("../dist/policy.js");
function fixture() {
  const callbacks = {},
    opened = [];
  const contents = {
    session: {
      setPermissionCheckHandler: (handler) => (callbacks.check = handler),
      setPermissionRequestHandler: (handler) => (callbacks.request = handler),
    },
    setWindowOpenHandler: (handler) => (callbacks.popup = handler),
    on: (name, handler) => (callbacks[name] = handler),
  };
  secureContents(contents, PRODUCTION_ORIGIN, (url) => {
    const safe = externalUrl(url, PRODUCTION_ORIGIN);
    if (safe) opened.push(safe);
  });
  return { callbacks, opened };
}
test("OS media and permission checks fail closed regardless of origin or permission", () => {
  const { callbacks } = fixture();
  for (const permission of [
    "media",
    "display-capture",
    "notifications",
    "clipboard-read",
  ]) {
    assert.equal(callbacks.check({}, permission, PRODUCTION_ORIGIN), false);
    let result;
    callbacks.request({}, permission, (approved) => (result = approved));
    assert.equal(result, false);
  }
});
test("external navigation is blocked; only safe external links open in the OS browser", () => {
  const { callbacks, opened } = fixture();
  for (const url of [
    PRODUCTION_ORIGIN + "/w",
    "https://example.com",
    "file:///tmp/secret",
    "javascript:alert(1)",
  ]) {
    let prevented = false;
    callbacks["will-navigate"](
      { preventDefault: () => (prevented = true) },
      url
    );
    assert.equal(prevented, !url.startsWith(PRODUCTION_ORIGIN));
  }
  assert.deepEqual(opened, ["https://example.com/"]);
});
test("redirects and subframe navigation cannot open a privileged external frame", () => {
  const { callbacks, opened } = fixture();
  for (const url of ["https://example.com", "file:///tmp/secret"]) {
    let count = 0;
    callbacks["will-redirect"]({ preventDefault: () => count++ }, url);
    callbacks["will-frame-navigate"]({
      url,
      isMainFrame: false,
      preventDefault: () => count++,
    });
    assert.equal(count, 2);
  }
  let attached = true;
  callbacks["will-attach-webview"]({
    preventDefault: () => (attached = false),
  });
  assert.equal(attached, false);
  assert.deepEqual(opened, []);
});
test("all popup creation is denied including same-origin; dangerous schemes are never opened", () => {
  const { callbacks, opened } = fixture();
  for (const url of [
    PRODUCTION_ORIGIN,
    "https://example.com",
    "file:///tmp/secret",
    "javascript:alert(1)",
  ])
    assert.deepEqual(callbacks.popup({ url }), { action: "deny" });
  assert.deepEqual(opened, ["https://example.com/"]);
});

// Electron emits will-frame-navigate before will-navigate and stops the sequence on cancellation.
function navigate(callbacks, url, isMainFrame) {
  let prevented = false;
  let reachedWillNavigate = false;
  const event = { url, isMainFrame, preventDefault: () => (prevented = true) };
  callbacks["will-frame-navigate"](event);
  if (!prevented && isMainFrame) {
    reachedWillNavigate = true;
    callbacks["will-navigate"](event, url);
  }
  return { prevented, reachedWillNavigate };
}
test("main-frame target=self external clicks reach will-navigate and open the browser once", () => {
  const { callbacks, opened } = fixture();
  assert.deepEqual(navigate(callbacks, "https://example.com/meeting", true), {
    prevented: true,
    reachedWillNavigate: true,
  });
  assert.deepEqual(opened, ["https://example.com/meeting"]);
  assert.deepEqual(navigate(callbacks, PRODUCTION_ORIGIN + "/w", true), {
    prevented: false,
    reachedWillNavigate: true,
  });
  assert.equal(opened.length, 1);
});
test("external subframes are cancelled before will-navigate and never launch the browser", () => {
  const { callbacks, opened } = fixture();
  assert.deepEqual(navigate(callbacks, "https://example.com/meeting", false), {
    prevented: true,
    reachedWillNavigate: false,
  });
  assert.deepEqual(opened, []);
  assert.deepEqual(navigate(callbacks, PRODUCTION_ORIGIN + "/frame", false), {
    prevented: false,
    reachedWillNavigate: false,
  });
});
test("unsafe main-frame navigation remains blocked without an external browser launch", () => {
  const { callbacks, opened } = fixture();
  for (const url of [
    "file:///tmp/secret",
    "javascript:alert(1)",
    "https://user:pass@example.com",
  ])
    assert.deepEqual(navigate(callbacks, url, true), {
      prevented: true,
      reachedWillNavigate: true,
    });
  assert.deepEqual(opened, []);
});

test("pending authentication survives cancelled external navigation and ends on document replacement", () => {
  const { callbacks, opened } = fixture();
  let revoked = 0;
  onDocumentReplacement(
    { on: (name, handler) => (callbacks[name] = handler) },
    PRODUCTION_ORIGIN,
    () => revoked++
  );
  // Electron starts navigation before the cancellable will-* events.
  callbacks["did-start-navigation"](
    {},
    "https://example.com/meeting",
    false,
    true
  );
  assert.equal(
    navigate(callbacks, "https://example.com/meeting", true).prevented,
    true
  );
  assert.equal(revoked, 0);
  assert.deepEqual(opened, ["https://example.com/meeting"]);
  callbacks["did-start-navigation"](
    {},
    PRODUCTION_ORIGIN + "/w#section",
    true,
    true
  );
  callbacks["did-start-navigation"](
    {},
    PRODUCTION_ORIGIN + "/frame",
    false,
    false
  );
  assert.equal(revoked, 0);
  callbacks["did-start-navigation"]({}, PRODUCTION_ORIGIN + "/w", false, true);
  assert.equal(revoked, 1);
  callbacks["did-navigate"]({}, "about:blank");
  assert.equal(revoked, 2);
});
