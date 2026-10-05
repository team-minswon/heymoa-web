const { test } = require("node:test");
const assert = require("node:assert/strict");
const { MediaGrant, captureId } = require("../dist/media-grant.js");
const { PRODUCTION_ORIGIN: origin } = require("../dist/policy.js");
function fixture(t) {
  const changes = [],
    grant = new MediaGrant((value) => changes.push(value)),
    frame = {};
  t.after(() => grant.revoke());
  return { grant, frame, changes };
}
test("one grant approves only one display and one microphone request", (t) => {
  t.mock.timers.enable({ apis: ["Date", "setTimeout"], now: 1000 });
  const { grant, frame, changes } = fixture(t);
  const id = grant.begin(frame);
  assert.equal(captureId(id), id);
  assert.throws(() => grant.begin(frame));
  assert.equal(grant.allowPermission(frame, origin, origin, []), true);
  assert.equal(grant.allowPermission(frame, origin, origin, []), false);
  assert.equal(grant.allowPermission(frame, origin, origin, ["audio"]), true);
  assert.equal(grant.allowPermission(frame, origin, origin, ["audio"]), false);
  const request = {
    frame,
    securityOrigin: origin,
    userGesture: true,
    videoRequested: true,
    audioRequested: true,
  };
  assert.equal(grant.claimDisplay(request, frame, origin), id);
  assert.equal(grant.claimDisplay(request, frame, origin), null);
  grant.ready(id);
  t.mock.timers.tick(200000);
  assert.equal(grant.alive(frame, origin, origin), true);
  grant.end(id);
  assert.deepEqual(changes, [true, false]);
  assert.equal(grant.alive(frame, origin, origin), false);
});
test("wrong frame/origin/camera and non-gesture display requests cannot claim capture", (t) => {
  const { grant, frame } = fixture(t);
  grant.begin(frame);
  for (const args of [
    [{}, origin, origin, ["audio"]],
    [frame, "https://evil.test", origin, ["audio"]],
    [frame, origin, origin, ["video"]],
    [frame, origin, origin, ["audio", "video"]],
    [frame, origin, origin, undefined],
  ])
    assert.equal(grant.allowPermission(...args), false);
  grant.allowPermission(frame, origin, origin, []);
  const good = {
    frame,
    securityOrigin: origin,
    userGesture: true,
    videoRequested: true,
    audioRequested: true,
  };
  for (const patch of [
    { frame: {} },
    { frame: null },
    { securityOrigin: "https://evil.test" },
    { userGesture: false },
    { audioRequested: false },
    { videoRequested: false },
  ])
    assert.equal(
      grant.claimDisplay({ ...good, ...patch }, frame, origin),
      null
    );
});
test("revocation invalidates an in-flight source lookup and stale release cannot end a new capture", (t) => {
  const { grant, frame } = fixture(t);
  const old = grant.begin(frame);
  grant.revoke();
  const fresh = grant.begin(frame);
  assert.equal(grant.valid(old, frame, origin, origin), false);
  grant.end(old);
  assert.equal(grant.valid(fresh, frame, origin, origin), true);
  assert.throws(() => grant.ready(fresh));
  for (const payload of [null, {}, "hello", fresh + "extra"])
    assert.throws(() => captureId(payload));
});
test("expired pending grants cannot approve or activate capture", (t) => {
  t.mock.timers.enable({ apis: ["Date", "setTimeout"], now: 1000 });
  const { grant, frame, changes } = fixture(t);
  const id = grant.begin(frame);
  t.mock.timers.tick(120000);
  assert.equal(grant.allowPermission(frame, origin, origin, ["audio"]), false);
  assert.throws(() => grant.ready(id));
  assert.deepEqual(changes, [true, false]);
});
