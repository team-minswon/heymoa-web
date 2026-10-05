const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  RecordingLifecycle,
  STOP_WAIT_NOTICE_MS,
} = require("../dist/recording-lifecycle");
const idle = {
  phase: "idle",
  startedAt: null,
  pendingMs: 0,
  microphone: null,
  systemAudio: null,
};
function fixture(confirm = async () => "cancel") {
  let now = 65_000,
    quits = 0,
    notices = 0,
    scheduled = null;
  const actions = [];
  const model = new RecordingLifecycle({
    now: () => now,
    confirm,
    action: (action) => actions.push(action),
    quit: () => quits++,
    changed() {},
    notifyWaiting: () => notices++,
    schedule: (callback, ms) => {
      assert.equal(ms, STOP_WAIT_NOTICE_MS);
      scheduled = callback;
      return () => {
        scheduled = null;
      };
    },
  });
  return {
    model,
    actions,
    get quits() {
      return quits;
    },
    get notices() {
      return notices;
    },
    notice: () => scheduled?.(),
    get scheduled() {
      return scheduled;
    },
  };
}
test("active and failed/stopped pending summaries are protected while inactive drained states are safe", async () => {
  for (const phase of [
    "requesting-permission",
    "connecting",
    "recording",
    "stopping",
  ]) {
    const f = fixture();
    f.model.update({ ...idle, phase });
    await f.model.requestQuit();
    assert.equal(f.quits, 0);
  }
  for (const phase of ["idle", "completed", "failed"]) {
    const f = fixture();
    f.model.update({ ...idle, phase, pendingMs: 200 });
    await f.model.requestQuit();
    assert.equal(f.quits, 0);
    f.model.update({ ...idle, phase });
    await f.model.requestQuit();
    assert.equal(f.quits, 1);
  }
});
test("stop then quit awaits both actual controller stop and durable pending clearance", async () => {
  const f = fixture(async () => "wait");
  f.model.update({ ...idle, phase: "recording", startedAt: 0, pendingMs: 20 });
  await f.model.requestQuit();
  assert.deepEqual(f.actions, ["stop"]);
  assert.equal(f.quits, 0);
  f.model.update({ ...idle, phase: "stopping" });
  assert.equal(f.quits, 0);
  f.model.update({ ...idle, phase: "failed", pendingMs: 20 });
  assert.equal(f.quits, 0);
  f.model.update({ ...idle, phase: "failed" });
  assert.equal(f.quits, 1);
  assert.equal(f.scheduled, null);
});
test("a long wait informs the user and renderer loss never becomes successful completion", async () => {
  const f = fixture(async () => "wait");
  f.model.update({ ...idle, phase: "recording" });
  await f.model.requestQuit();
  f.model.unavailable();
  f.notice();
  assert.equal(f.notices, 1);
  assert.equal(f.quits, 0);
  assert.equal(f.model.view().unknown, true);
  assert.equal(f.model.safe(), false);
});
test("discard requires a second explicit confirmation and cannot be authorized by the first choice", async () => {
  const prompts = [],
    answers = ["discard", "cancel", "discard", "discard"];
  const f = fixture(async (prompt) => {
    prompts.push(prompt);
    return answers.shift();
  });
  await f.model.requestQuit();
  assert.equal(f.quits, 0);
  await f.model.requestQuit();
  assert.equal(f.quits, 1);
  assert.deepEqual(prompts, ["protect", "discard", "protect", "discard"]);
});
test("cancel waiting clears its timer and a later drained report cannot quit", async () => {
  const answers = ["wait", "cancel"];
  const f = fixture(async () => answers.shift());
  f.model.update({ ...idle, phase: "recording" });
  await f.model.requestQuit();
  await f.model.requestQuit();
  assert.equal(f.scheduled, null);
  f.model.update(idle);
  assert.equal(f.quits, 0);
});
test("overlapping quit prompts are single flight and disposed late answers do nothing", async () => {
  let answer,
    calls = 0;
  const f = fixture(() => {
    calls++;
    return new Promise((resolve) => {
      answer = resolve;
    });
  });
  const pending = f.model.requestQuit();
  await f.model.requestQuit();
  assert.equal(calls, 1);
  f.model.dispose();
  answer("wait");
  await pending;
  assert.deepEqual(f.actions, []);
  assert.equal(f.quits, 0);
});
test("a new recording arriving while dialog is open is not mistaken for the old safe state", async () => {
  let answer;
  const f = fixture(
    () =>
      new Promise((resolve) => {
        answer = resolve;
      })
  );
  const pending = f.model.requestQuit();
  f.model.update(idle);
  f.model.update({ ...idle, phase: "recording" });
  answer("wait");
  await pending;
  assert.deepEqual(f.actions, ["stop"]);
  assert.equal(f.quits, 0);
});
test("elapsed time and input failures reflect state without copying private meeting content", () => {
  const f = fixture();
  const summary = {
    ...idle,
    phase: "recording",
    startedAt: 0,
    pendingMs: 20,
    microphone: "muted",
    systemAudio: "ended",
  };
  f.model.update(summary);
  summary.phase = "completed";
  assert.deepEqual(f.model.view(), {
    label: "녹음 중",
    elapsed: "1:05",
    pending: true,
    inputWarning: "마이크 음소거 · 시스템 소리 종료",
    unknown: false,
    waiting: false,
  });
  assert.equal(f.model.safe(), false);
});
