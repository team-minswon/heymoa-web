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
