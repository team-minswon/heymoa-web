import { describe, expect, it } from "vitest";

import { ResendBuffer } from "@/lib/transcription/resend-buffer";

function chunk(chunkSeq: number, bytes = 3_200) {
  return {
    chunkSeq,
    captureSamples: chunkSeq * 1_600,
    body: new ArrayBuffer(bytes),
  };
}

describe("ResendBuffer", () => {
  it("ACK 이하를 버린다", () => {
    const buffer = new ResendBuffer(10_485_760);
    [0, 1, 2, 3].forEach((n) => buffer.push(chunk(n)));

    buffer.ackThrough(1);

    expect(buffer.pending().map((c) => c.chunkSeq)).toEqual([2, 3]);
  });

  it("재전송은 원래 번호와 캡처 위치를 그대로 쓴다", () => {
    const buffer = new ResendBuffer(10_485_760);
    buffer.push(chunk(7));

    expect(buffer.pending()[0]).toMatchObject({
      chunkSeq: 7,
      captureSamples: 11_200,
    });
  });

  it("상한을 넘으면 오래된 것부터 버리고 번호를 남긴다", () => {
    const buffer = new ResendBuffer(6_400);
    [0, 1, 2].forEach((n) => buffer.push(chunk(n)));

    expect(buffer.pending().map((c) => c.chunkSeq)).toEqual([1, 2]);
    expect(buffer.droppedChunkSeqs).toEqual([0]);
  });

  it("늦게 온 옛 ACK 가 버퍼를 되살리지 않는다", () => {
    const buffer = new ResendBuffer(10_485_760);
    [0, 1, 2].forEach((n) => buffer.push(chunk(n)));

    buffer.ackThrough(2);
    buffer.ackThrough(0);

    expect(buffer.pending()).toEqual([]);
  });

  it("버퍼가 빈 상태에서 ACK 를 받아도 터지지 않는다", () => {
    const buffer = new ResendBuffer(10_485_760);

    expect(() => buffer.ackThrough(42)).not.toThrow();
    expect(buffer.bytes).toBe(0);
  });

  it("건넨 것은 unsent 에서 빠지고 거절된 것은 남는다", () => {
    const buffer = new ResendBuffer(10_485_760);
    [0, 1, 2].forEach((n) => buffer.push(chunk(n)));

    buffer.markSent();
    buffer.markSent();

    expect(buffer.unsent().map((c) => c.chunkSeq)).toEqual([2]);
  });

  it("ACK 가 오면 unsent 커서가 안 밀린다", () => {
    const buffer = new ResendBuffer(10_485_760);
    [0, 1, 2].forEach((n) => buffer.push(chunk(n)));
    buffer.markSent();
    buffer.markSent();

    buffer.ackThrough(0);

    // 0이 빠졌으므로 남은 것은 1(건넴)·2(안 건넴)이고 unsent 는 2 하나여야 한다
    expect(buffer.pending().map((c) => c.chunkSeq)).toEqual([1, 2]);
    expect(buffer.unsent().map((c) => c.chunkSeq)).toEqual([2]);
  });

  it("rewind 하면 ACK 못 받은 것부터 다시 보낸다", () => {
    const buffer = new ResendBuffer(10_485_760);
    [0, 1, 2].forEach((n) => buffer.push(chunk(n)));
    buffer.markSent();
    buffer.markSent();
    buffer.markSent();
    expect(buffer.unsent()).toEqual([]);

    buffer.rewind();

    expect(buffer.unsent().map((c) => c.chunkSeq)).toEqual([0, 1, 2]);
  });

  it("상한으로 버려도 unsent 커서가 어긋나지 않는다", () => {
    const buffer = new ResendBuffer(6_400);
    [0, 1].forEach((n) => buffer.push(chunk(n)));
    buffer.markSent();
    buffer.markSent();

    buffer.push(chunk(2)); // 0이 밀려난다

    expect(buffer.pending().map((c) => c.chunkSeq)).toEqual([1, 2]);
    expect(buffer.unsent().map((c) => c.chunkSeq)).toEqual([2]);
  });
});
