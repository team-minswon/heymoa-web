const { test } = require("node:test");
const assert = require("node:assert/strict");
const { capturePacket } = require("../dist/capture-protocol.js");
test("only bounded PCM16 and source metadata cross the local capture boundary", () => {
  const pcm = {
    kind: "pcm",
    id: "capture",
    sequence: 0,
    captureSamples: 0,
    samples: new ArrayBuffer(3200),
  };
  assert.equal(capturePacket(pcm, "capture"), pcm);
  for (const invalid of [
    { ...pcm, samples: new ArrayBuffer(3202) },
    { ...pcm, samples: new ArrayBuffer(3) },
    { ...pcm, captureSamples: -1 },
    { ...pcm, sequence: 0.1 },
    { ...pcm, video: "frame" },
    { ...pcm, id: "old" },
    { kind: "video", id: "capture", samples: new ArrayBuffer(10) },
    { kind: "levels", id: "capture", microphone: NaN, systemAudio: 1 },
    {
      kind: "states",
      id: "capture",
      microphone: "live",
      systemAudio: "unknown",
    },
    { kind: "error", id: "capture", code: "raw secret" },
  ])
    assert.throws(() => capturePacket(invalid, "capture"));
  assert.doesNotThrow(() =>
    capturePacket(
      { kind: "levels", id: "capture", microphone: 0, systemAudio: 1 },
      "capture"
    )
  );
  assert.doesNotThrow(() =>
    capturePacket(
      {
        kind: "states",
        id: "capture",
        microphone: "live",
        systemAudio: "ended",
      },
      "capture"
    )
  );
});
const {
  PcmSender,
  CAPTURE_BACKLOG_MS,
} = require("../dist/capture-protocol.js");
function sender() {
  const sent = [];
  return {
    sent,
    sender: new PcmSender("capture", (packet) => sent.push(packet)),
  };
}
const chunk = (index) => [new ArrayBuffer(3200), index * 1600];
test("a 300 ms main-window stall queues chunks instead of overflowing, then drains in order", () => {
  const { sent, sender: s } = sender();
  assert.equal(s.push(...chunk(0)), true);
  // Main window stalls: no ACK while three more 100 ms chunks arrive.
  for (let index = 1; index <= 3; index++)
    assert.equal(s.push(...chunk(index)), true);
  assert.equal(sent.length, 1);
  for (let sequence = 0; sequence < 4; sequence++) s.ack(sequence);
  assert.deepEqual(
    sent.map((packet) => packet.sequence),
    [0, 1, 2, 3]
  );
  assert.deepEqual(
    sent.map((packet) => packet.captureSamples),
    [0, 1600, 3200, 4800]
  );
});
test("backlog overflows only beyond the bounded queue", () => {
  const { sender: s } = sender();
  const queued = CAPTURE_BACKLOG_MS / 100;
  assert.equal(queued, 30);
  s.push(...chunk(0));
  for (let index = 1; index <= queued; index++)
    assert.equal(s.push(...chunk(index)), true);
  assert.equal(s.push(...chunk(queued + 1)), false);
});
test("drain waits for queued chunks, not only the one in flight", async () => {
  const { sender: s } = sender();
  s.push(...chunk(0));
  s.push(...chunk(1));
  let drained = false;
  const drain = s.drain().then(() => (drained = true));
  s.ack(0);
  await new Promise(setImmediate);
  assert.equal(drained, false);
  s.ack(1);
  await drain;
  assert.equal(drained, true);
});
test("drain gives up after the backlog bound with the backpressure code", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const { sender: s } = sender();
  s.push(...chunk(0));
  const drain = s.drain();
  t.mock.timers.tick(CAPTURE_BACKLOG_MS);
  await assert.rejects(drain, /DESKTOP_AUDIO_BACKPRESSURE/);
});
test("drain keeps waiting while ACKs make progress, even past the bound in total", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const { sent, sender: s } = sender();
  for (let index = 0; index < 13; index++) s.push(...chunk(index));
  const drain = s.drain();
  for (let sequence = 0; sequence < 13; sequence++) {
    t.mock.timers.tick(250);
    s.ack(sequence);
  }
  await drain;
  assert.equal(sent.length, 13);
});
